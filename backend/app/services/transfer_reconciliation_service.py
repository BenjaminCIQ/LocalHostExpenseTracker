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


def _confidence(a: Transaction, b: Transaction) -> tuple[float, str]:
    score = 0.0
    reasons: list[str] = []

    if a.account_id != b.account_id:
        score += 0.25
        reasons.append("different accounts")
    if a.currency == b.currency:
        score += 0.2
        reasons.append("same currency")
    amount_delta = abs(abs(a.amount) - abs(b.amount))
    if amount_delta <= settings.transfer_amount_tolerance:
        score += 0.4
        reasons.append("amount match")
    day_delta = abs((a.date - b.date).days)
    if day_delta <= settings.transfer_date_window_days:
        score += 0.1
        reasons.append("close date")
    text_score = SequenceMatcher(
        None,
        (a.description or a.raw_description or "").lower(),
        (b.description or b.raw_description or "").lower(),
    ).ratio() * 100
    if text_score >= 70:
        score += 0.05
        reasons.append("description similarity")
    return min(score, 1.0), ", ".join(reasons) if reasons else "weak match"


def is_transfer_like_transaction(txn: Transaction) -> bool:
    return txn.transaction_kind == "transfer" or bool(txn.is_internal_transfer)


def find_transfer_candidates(
    db: Session,
    limit: int = 100,
    account_id: int | None = None,
    person_account_ids: list[int] | None = None,
) -> list[TransferCandidateResult]:
    base = db.query(Transaction).filter(
        Transaction.is_internal_transfer.is_(False),
        Transaction.transfer_group_id.is_(None),
    )
    if account_id is not None:
        base = base.filter(Transaction.account_id == account_id)
    if person_account_ids:
        base = base.filter(Transaction.account_id.in_(person_account_ids))
    txns = base.order_by(Transaction.date.desc()).limit(limit).all()
    results: list[TransferCandidateResult] = []

    for txn in txns:
        window_start = txn.date - timedelta(days=settings.transfer_date_window_days)
        window_end = txn.date + timedelta(days=settings.transfer_date_window_days)
        candidates = (
            db.query(Transaction)
            .filter(
                Transaction.id != txn.id,
                Transaction.account_id != txn.account_id,
                Transaction.is_internal_transfer.is_(False),
                Transaction.transfer_group_id.is_(None),
                Transaction.currency == txn.currency,
                Transaction.date >= window_start,
                Transaction.date <= window_end,
            )
            .all()
        )
        for cand in candidates:
            if txn.amount == 0 or cand.amount == 0:
                continue
            if txn.amount * cand.amount >= 0:
                continue
            if abs(abs(txn.amount) - abs(cand.amount)) > settings.transfer_amount_tolerance:
                continue
            score, reason = _confidence(txn, cand)
            if score < settings.transfer_review_confidence_threshold:
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
                    reason=reason,
                )
            )

    dedup: dict[tuple[int, int], TransferCandidateResult] = {}
    for item in results:
        key = tuple(sorted([item.transaction_id, item.candidate_id]))
        if key not in dedup or dedup[key].score < item.score:
            dedup[key] = item
    return sorted(dedup.values(), key=lambda x: x.score, reverse=True)


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


def auto_link_high_confidence(db: Session, limit: int = 200) -> tuple[int, int, int]:
    candidates = find_transfer_candidates(db, limit=limit)
    linked = 0
    reviewed = 0
    skipped = 0
    used_ids: set[int] = set()
    for cand in candidates:
        if cand.transaction_id in used_ids or cand.candidate_id in used_ids:
            skipped += 1
            continue
        reviewed += 1
        if cand.score >= settings.transfer_high_confidence_threshold:
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
