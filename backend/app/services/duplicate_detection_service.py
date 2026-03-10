from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import timedelta
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.models.duplicate_override import DuplicateOverride
from app.models.transaction import Transaction
from app.parsers.base import ParsedTransaction


def normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def compute_incoming_fingerprint(account_id: int, p: ParsedTransaction) -> str:
    key = "|".join(
        [
            str(account_id),
            str(p.date),
            f"{p.amount:.2f}",
            (p.currency or "EUR").upper(),
            normalize_text(p.raw_description),
            normalize_text(p.description),
            normalize_text(p.merchant),
        ]
    )
    return hashlib.sha256(key.encode()).hexdigest()


@dataclass
class PotentialDuplicate:
    duplicate_key: str
    rating: float
    reason: str
    transaction_id: int
    incoming_date: str
    incoming_amount: float
    incoming_currency: str
    incoming_merchant: str
    incoming_description: str
    incoming_raw_description: str
    existing_date: str
    existing_amount: float
    existing_currency: str
    existing_merchant: str
    existing_description: str
    existing_raw_description: str


def _score_duplicate(p: ParsedTransaction, existing: Transaction) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    if (p.currency or "EUR").upper() == (existing.currency or "EUR").upper():
        score += 0.2
        reasons.append("same currency")

    amount_delta = abs(float(p.amount) - float(existing.amount))
    if amount_delta <= 0.0001:
        score += 0.45
        reasons.append("exact amount")
    elif amount_delta <= 0.01:
        score += 0.28
        reasons.append("near amount")

    day_delta = abs((p.date - existing.date).days)
    if day_delta == 0:
        score += 0.22
        reasons.append("same date")
    elif day_delta <= 1:
        score += 0.12
        reasons.append("near date")

    incoming_raw = normalize_text(p.raw_description)
    existing_raw = normalize_text(existing.raw_description)
    incoming_desc = normalize_text(p.description)
    existing_desc = normalize_text(existing.description)
    incoming_merchant = normalize_text(p.merchant)
    existing_merchant = normalize_text(existing.merchant)

    if incoming_raw and incoming_raw == existing_raw:
        score += 0.2
        reasons.append("same raw text")
    else:
        desc_ratio = SequenceMatcher(None, incoming_desc, existing_desc).ratio()
        merchant_ratio = SequenceMatcher(None, incoming_merchant, existing_merchant).ratio()
        if desc_ratio >= 0.9:
            score += 0.12
            reasons.append("very similar description")
        elif desc_ratio >= 0.75:
            score += 0.06
            reasons.append("similar description")
        if merchant_ratio >= 0.9:
            score += 0.08
            reasons.append("same merchant")
        elif merchant_ratio >= 0.75:
            score += 0.04
            reasons.append("similar merchant")

    return min(score, 1.0), reasons


def find_potential_duplicate_for_parsed(
    db: Session,
    account_id: int,
    p: ParsedTransaction,
    *,
    min_score: float = 0.65,
) -> PotentialDuplicate | None:
    fingerprint = compute_incoming_fingerprint(account_id, p)
    override_exists = (
        db.query(DuplicateOverride.id)
        .filter(
            DuplicateOverride.account_id == account_id,
            DuplicateOverride.incoming_fingerprint == fingerprint,
        )
        .first()
    )
    if override_exists:
        return None

    window_start = p.date - timedelta(days=3)
    window_end = p.date + timedelta(days=3)
    candidates = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.date >= window_start,
            Transaction.date <= window_end,
        )
        .all()
    )
    best: tuple[Transaction, float, list[str]] | None = None
    for existing in candidates:
        score, reasons = _score_duplicate(p, existing)
        if score < min_score:
            continue
        if best is None or score > best[1]:
            best = (existing, score, reasons)

    if best is None:
        return None
    existing, rating, reasons = best
    return PotentialDuplicate(
        duplicate_key=fingerprint,
        rating=round(rating, 3),
        reason=", ".join(reasons) if reasons else "possible duplicate",
        transaction_id=existing.id,
        incoming_date=str(p.date),
        incoming_amount=float(p.amount),
        incoming_currency=(p.currency or "EUR").upper(),
        incoming_merchant=p.merchant or "",
        incoming_description=p.description or "",
        incoming_raw_description=p.raw_description or "",
        existing_date=str(existing.date),
        existing_amount=float(existing.amount),
        existing_currency=existing.currency or "",
        existing_merchant=existing.merchant or "",
        existing_description=existing.description or "",
        existing_raw_description=existing.raw_description or "",
    )


def store_duplicate_overrides(
    db: Session,
    account_id: int,
    duplicate_keys: list[str],
) -> int:
    created = 0
    seen: set[str] = set()
    for key in duplicate_keys:
        cleaned = (key or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        exists = (
            db.query(DuplicateOverride.id)
            .filter(
                DuplicateOverride.account_id == account_id,
                DuplicateOverride.incoming_fingerprint == cleaned,
            )
            .first()
        )
        if exists:
            continue
        db.add(
            DuplicateOverride(
                account_id=account_id,
                incoming_fingerprint=cleaned,
            )
        )
        created += 1
    return created


def find_existing_potential_duplicates(
    db: Session,
    account_id: int | None = None,
    person_account_ids: list[int] | None = None,
    limit: int = 200,
) -> list[dict]:
    query = db.query(Transaction)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if person_account_ids:
        query = query.filter(Transaction.account_id.in_(person_account_ids))
    rows = query.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit).all()
    out: list[dict] = []
    seen_pairs: set[tuple[int, int]] = set()
    by_account: dict[int, list[Transaction]] = {}
    for txn in rows:
        by_account.setdefault(txn.account_id, []).append(txn)
    for _acc_id, txns in by_account.items():
        for i, a in enumerate(txns):
            for b in txns[i + 1 :]:
                if abs((a.date - b.date).days) > 3:
                    continue
                pseudo_parsed = ParsedTransaction(
                    date=a.date,
                    amount=a.amount,
                    raw_description=a.raw_description or "",
                    description=a.description or "",
                    merchant=a.merchant or "",
                    currency=a.currency or "EUR",
                )
                score, reasons = _score_duplicate(pseudo_parsed, b)
                if score < 0.72:
                    continue
                pair = tuple(sorted((a.id, b.id)))
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                out.append(
                    {
                        "transaction_id": a.id,
                        "candidate_id": b.id,
                        "account_id": a.account_id,
                        "rating": round(score, 3),
                        "reason": ", ".join(reasons) if reasons else "possible duplicate",
                    }
                )
    out.sort(key=lambda x: x["rating"], reverse=True)
    return out[:limit]
