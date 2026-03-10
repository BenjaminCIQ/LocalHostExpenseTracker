from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from difflib import SequenceMatcher
from uuid import uuid4

from sqlalchemy.orm import Session

from app.config import settings
from app.models.transaction import Transaction


@dataclass
class TransferCandidateResult:
    transaction_id: int
    candidate_id: int
    transaction_date: str
    candidate_date: str
    transaction_amount: float
    candidate_amount: float
    transaction_account_id: int
    candidate_account_id: int
    transaction_currency: str
    candidate_currency: str
    score: float
    reason: str
    reasons: list[str]
    transaction_description: str
    candidate_description: str
    transaction_raw_description: str
    candidate_raw_description: str
    transaction_merchant: str
    candidate_merchant: str
    transaction_kind: str
    candidate_kind: str
    transaction_is_internal_transfer: bool
    candidate_is_internal_transfer: bool
    transaction_transfer_group_id: str | None
    candidate_transfer_group_id: str | None


def _confidence(
    a: Transaction,
    b: Transaction,
    *,
    amount_tolerance: float,
    date_window_days: int,
) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    # Hard constraints for valid transfer pair.
    if a.account_id == b.account_id:
        return 0.0, ["same account"]
    if a.amount == 0 or b.amount == 0:
        return 0.0, ["zero amount"]
    if a.amount * b.amount >= 0:
        return 0.0, ["same sign amount"]

    if a.account_id != b.account_id:
        score += 0.2
        reasons.append("different accounts")
    if a.currency == b.currency:
        score += 0.2
        reasons.append("same currency")
    else:
        score -= 0.35
        reasons.append("currency mismatch")

    amount_delta = abs(abs(a.amount) - abs(b.amount))
    base_amount = max(abs(a.amount), abs(b.amount), 1.0)
    amount_delta_ratio = amount_delta / base_amount
    if amount_delta <= amount_tolerance:
        score += 0.45
        reasons.append("amount match")
    elif amount_delta_ratio <= 0.01:
        score += 0.2
        reasons.append("near amount match")
    else:
        score -= 0.3
        reasons.append("amount mismatch")

    day_delta = abs((a.date - b.date).days)
    if day_delta <= date_window_days:
        # Date proximity decays linearly to the edge of the window.
        score += max(0.05, 0.25 * (1 - (day_delta / max(date_window_days, 1))))
        reasons.append("close date")
    else:
        score -= 0.25
        reasons.append("date outside window")

    if abs(abs(a.amount) - abs(b.amount)) <= 0.005:
        score += 0.1
        reasons.append("exact opposite amount")

    text_score = SequenceMatcher(
        None,
        (a.description or a.raw_description or "").lower(),
        (b.description or b.raw_description or "").lower(),
    ).ratio() * 100
    merchant_score = SequenceMatcher(
        None,
        (a.merchant or "").lower(),
        (b.merchant or "").lower(),
    ).ratio() * 100
    if text_score >= 80:
        score += 0.07
        reasons.append("description similarity")
    elif text_score <= 25:
        score -= 0.06
    if merchant_score >= 80:
        score += 0.05
        reasons.append("merchant similarity")

    return max(0.0, min(score, 1.0)), reasons or ["weak match"]


def is_transfer_like_transaction(txn: Transaction) -> bool:
    return txn.transaction_kind == "transfer" or bool(txn.is_internal_transfer)


def find_transfer_candidates(
    db: Session,
    limit: int = 100,
    seed_limit: int | None = None,
    max_results: int | None = None,
    min_confidence: float | None = None,
    amount_tolerance: float | None = None,
    date_window_days: int | None = None,
    account_id: int | None = None,
    person_account_ids: list[int] | None = None,
) -> list[TransferCandidateResult]:
    seed_limit = seed_limit if seed_limit is not None else limit
    max_results = max_results if max_results is not None else limit
    min_confidence = (
        min_confidence
        if min_confidence is not None
        else settings.transfer_review_confidence_threshold
    )
    amount_tolerance = (
        amount_tolerance
        if amount_tolerance is not None
        else settings.transfer_amount_tolerance
    )
    date_window_days = (
        date_window_days
        if date_window_days is not None
        else settings.transfer_date_window_days
    )

    base = db.query(Transaction).filter(
        Transaction.is_internal_transfer.is_(False),
        Transaction.transfer_group_id.is_(None),
    )
    if account_id is not None:
        base = base.filter(Transaction.account_id == account_id)
    if person_account_ids:
        base = base.filter(Transaction.account_id.in_(person_account_ids))
    txns = base.order_by(Transaction.date.desc()).limit(seed_limit).all()
    results: list[TransferCandidateResult] = []

    for txn in txns:
        window_start = txn.date - timedelta(days=date_window_days)
        window_end = txn.date + timedelta(days=date_window_days)
        candidates = (
            db.query(Transaction)
            .filter(
                Transaction.id != txn.id,
                Transaction.account_id != txn.account_id,
                Transaction.is_internal_transfer.is_(False),
                Transaction.transfer_group_id.is_(None),
                Transaction.date >= window_start,
                Transaction.date <= window_end,
            )
            .all()
        )
        for cand in candidates:
            score, reasons = _confidence(
                txn,
                cand,
                amount_tolerance=amount_tolerance,
                date_window_days=date_window_days,
            )
            if score < min_confidence:
                continue
            results.append(
                TransferCandidateResult(
                    transaction_id=txn.id,
                    candidate_id=cand.id,
                    transaction_date=str(txn.date),
                    candidate_date=str(cand.date),
                    transaction_amount=float(txn.amount),
                    candidate_amount=float(cand.amount),
                    transaction_account_id=txn.account_id,
                    candidate_account_id=cand.account_id,
                    transaction_currency=txn.currency,
                    candidate_currency=cand.currency,
                    score=round(score, 3),
                    reason=", ".join(reasons),
                    reasons=reasons,
                    transaction_description=txn.description or "",
                    candidate_description=cand.description or "",
                    transaction_raw_description=txn.raw_description or "",
                    candidate_raw_description=cand.raw_description or "",
                    transaction_merchant=txn.merchant or "",
                    candidate_merchant=cand.merchant or "",
                    transaction_kind=txn.transaction_kind or "",
                    candidate_kind=cand.transaction_kind or "",
                    transaction_is_internal_transfer=bool(txn.is_internal_transfer),
                    candidate_is_internal_transfer=bool(cand.is_internal_transfer),
                    transaction_transfer_group_id=txn.transfer_group_id,
                    candidate_transfer_group_id=cand.transfer_group_id,
                )
            )

    dedup: dict[tuple[int, int], TransferCandidateResult] = {}
    for item in results:
        key = tuple(sorted([item.transaction_id, item.candidate_id]))
        if key not in dedup or dedup[key].score < item.score:
            dedup[key] = item
    return sorted(
        dedup.values(),
        key=lambda x: (x.score, x.transaction_date, x.transaction_id),
        reverse=True,
    )[:max_results]


def link_transfer_pair(
    db: Session,
    transaction_id: int,
    candidate_id: int,
    confidence: float | None,
    source: str = "manual",
) -> str:
    txn = db.get(Transaction, transaction_id)
    cand = db.get(Transaction, candidate_id)
    if not txn or not cand:
        raise ValueError("Transaction not found")
    if txn.id == cand.id:
        raise ValueError("Cannot link transaction to itself")
    transfer_group_id = txn.transfer_group_id or cand.transfer_group_id or str(uuid4())
    conf_val = confidence if confidence is not None else 1.0
    for entry, linked in ((txn, cand), (cand, txn)):
        entry.transaction_kind = "transfer"
        entry.is_internal_transfer = True
        entry.transfer_group_id = transfer_group_id
        entry.transfer_linked_transaction_id = linked.id
        entry.transfer_confidence = conf_val
        entry.transfer_match_source = source
        db.add(entry)
    db.commit()
    return transfer_group_id


def unlink_transfer(db: Session, transaction_id: int) -> bool:
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise ValueError("Transaction not found")
    group_id = txn.transfer_group_id
    if not group_id:
        return False
    members = db.query(Transaction).filter(Transaction.transfer_group_id == group_id).all()
    for item in members:
        item.transfer_group_id = None
        item.transfer_linked_transaction_id = None
        item.transfer_confidence = None
        item.transfer_match_source = None
        item.is_internal_transfer = False
        if item.amount > 0:
            item.transaction_kind = "income"
        elif item.amount < 0:
            item.transaction_kind = "expense"
        else:
            item.transaction_kind = "adjustment"
        db.add(item)
    db.commit()
    return True


def auto_link_high_confidence(
    db: Session,
    limit: int = 200,
    min_auto_confidence: float | None = None,
) -> tuple[int, int, int]:
    threshold = (
        min_auto_confidence
        if min_auto_confidence is not None
        else settings.transfer_high_confidence_threshold
    )
    candidates = find_transfer_candidates(
        db,
        limit=limit,
        seed_limit=limit,
        max_results=limit,
    )
    linked = 0
    reviewed = 0
    skipped = 0
    used_ids: set[int] = set()
    for cand in candidates:
        if cand.transaction_id in used_ids or cand.candidate_id in used_ids:
            skipped += 1
            continue
        reviewed += 1
        if cand.score >= threshold:
            try:
                link_transfer_pair(
                    db,
                    cand.transaction_id,
                    cand.candidate_id,
                    confidence=cand.score,
                    source="auto",
                )
                linked += 1
                used_ids.add(cand.transaction_id)
                used_ids.add(cand.candidate_id)
            except ValueError:
                skipped += 1
        else:
            skipped += 1
    return linked, reviewed, skipped
