import json
import re
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction
from app.models.trip import Trip, TripMembershipSuggestion, TripTransactionOverride

TRAVEL_KEYWORDS = (
    "air",
    "hotel",
    "booking",
    "train",
    "rail",
    "airport",
    "uber",
    "lyft",
    "taxi",
    "hostel",
    "flight",
)

HOME_BASELINE_KEYWORDS = (
    "netflix",
    "spotify",
    "rent",
    "insurance",
    "utility",
    "electric",
    "water",
    "internet",
    "gym",
    "subscription",
)


def _norm_merchant(text: str | None) -> str:
    raw = (text or "").strip().lower()
    raw = re.sub(r"[^a-z0-9\s]", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


@dataclass
class SuggestionResult:
    suggested_membership: str  # include|exclude|review
    score: float
    reasons: list[str]


def _classify_score(score: float, include_threshold: float, exclude_threshold: float) -> str:
    if score >= include_threshold:
        return "include"
    if score <= exclude_threshold:
        return "exclude"
    return "review"


def _merchant_outside_window_stats(
    db: Session,
    trip: Trip,
    merchant_norm: str,
):
    if not merchant_norm:
        return 0, 0.0
    rows = (
        db.query(Transaction.amount)
        .filter(
            func.lower(Transaction.merchant) == merchant_norm,
            ~and_(Transaction.date >= trip.start_date, Transaction.date <= trip.end_date),
        )
        .all()
    )
    if not rows:
        return 0, 0.0
    values = [abs(float(r[0])) for r in rows if r[0] is not None]
    if not values:
        return 0, 0.0
    return len(values), sum(values) / len(values)


def _is_recurring_before_after(db: Session, trip: Trip, merchant_norm: str) -> bool:
    if not merchant_norm:
        return False
    lookback_days = 45
    before_start = trip.start_date - timedelta(days=lookback_days)
    after_end = trip.end_date + timedelta(days=lookback_days)

    before_count = (
        db.query(Transaction.id)
        .filter(
            func.lower(Transaction.merchant) == merchant_norm,
            Transaction.date >= before_start,
            Transaction.date < trip.start_date,
        )
        .count()
    )
    after_count = (
        db.query(Transaction.id)
        .filter(
            func.lower(Transaction.merchant) == merchant_norm,
            Transaction.date > trip.end_date,
            Transaction.date <= after_end,
        )
        .count()
    )
    return before_count > 0 and after_count > 0


def _score_transaction(db: Session, trip: Trip, txn: Transaction) -> SuggestionResult:
    score = 0.0
    reasons: list[str] = []

    merchant_norm = _norm_merchant(txn.merchant)
    text = f"{txn.merchant or ''} {txn.description or ''} {txn.raw_description or ''}".lower()

    # Strong negative if merchant repeats before and after the trip.
    if _is_recurring_before_after(db, trip, merchant_norm):
        score -= 0.75
        reasons.append("recurring_before_after_trip")

    # Home-baseline subscription/utility hints.
    if any(k in text for k in HOME_BASELINE_KEYWORDS):
        score -= 0.35
        reasons.append("home_baseline_keyword")

    # Travel context hints.
    if any(k in text for k in TRAVEL_KEYWORDS):
        score += 0.45
        reasons.append("travel_keyword")

    if txn.currency and txn.currency.upper() != "EUR":
        score += 0.25
        reasons.append("foreign_currency")

    # If amount is unusual for this merchant outside the trip, this may be trip-related.
    outside_count, outside_avg = _merchant_outside_window_stats(db, trip, merchant_norm)
    if outside_count >= 3 and outside_avg > 0:
        current_abs = abs(float(txn.amount))
        if current_abs >= 1.7 * outside_avg:
            score += 0.3
            reasons.append("merchant_amount_outlier")
        elif current_abs <= 0.7 * outside_avg:
            score -= 0.15
            reasons.append("merchant_amount_typical")

    # Keep bounded and deterministic.
    score = max(-1.0, min(1.0, round(score, 4)))
    suggested = _classify_score(score, include_threshold=0.35, exclude_threshold=-0.35)
    return SuggestionResult(suggested_membership=suggested, score=score, reasons=reasons)


def recompute_trip_suggestions(
    db: Session,
    trip: Trip,
    *,
    force: bool = False,
) -> tuple[int, int]:
    # Manual overrides are user intent; suggestions should not replace them.
    manual_override_txn_ids = {
        row[0]
        for row in db.query(TripTransactionOverride.transaction_id)
        .filter(TripTransactionOverride.trip_id == trip.id)
        .all()
    }

    query = db.query(Transaction).filter(
        Transaction.date >= trip.start_date,
        Transaction.date <= trip.end_date,
    )
    in_window = query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()

    created_or_updated = 0
    skipped_manual = 0
    for txn in in_window:
        if txn.id in manual_override_txn_ids:
            skipped_manual += 1
            continue

        existing = (
            db.query(TripMembershipSuggestion)
            .filter(
                TripMembershipSuggestion.trip_id == trip.id,
                TripMembershipSuggestion.transaction_id == txn.id,
            )
            .first()
        )
        if existing and existing.is_applied and not force:
            continue

        result = _score_transaction(db, trip, txn)
        payload = {
            "suggested_membership": result.suggested_membership,
            "score": result.score,
            "reasons_json": json.dumps(result.reasons),
            "is_applied": False if (not existing or force) else existing.is_applied,
        }

        if existing:
            for key, value in payload.items():
                setattr(existing, key, value)
            created_or_updated += 1
        else:
            db.add(
                TripMembershipSuggestion(
                    trip_id=trip.id,
                    transaction_id=txn.id,
                    **payload,
                )
            )
            created_or_updated += 1

    db.commit()
    return created_or_updated, skipped_manual

