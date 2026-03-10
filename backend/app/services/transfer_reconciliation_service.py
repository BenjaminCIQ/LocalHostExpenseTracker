from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from difflib import SequenceMatcher
from uuid import uuid4

from sqlalchemy.orm import Session

from app.config import settings
from app.models.transaction import Transaction
from app.models.transfer_linking_rule import TransferLinkingRule
from app.services.search_query_parser import transaction_matches_keywords


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
    matched_rule_ids: list[int] = ()


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
    include_matched_rules: bool = True,
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
                    matched_rule_ids=(),
                )
            )

    dedup: dict[tuple[int, int], TransferCandidateResult] = {}
    for item in results:
        key = tuple(sorted([item.transaction_id, item.candidate_id]))
        if key not in dedup or dedup[key].score < item.score:
            dedup[key] = item
    final = sorted(
        dedup.values(),
        key=lambda x: (x.score, x.transaction_date, x.transaction_id),
        reverse=True,
    )[:max_results]

    if include_matched_rules and final:
        rules = (
            db.query(TransferLinkingRule)
            .filter(TransferLinkingRule.enabled.is_(True))
            .all()
        )
        if rules:
            pair_to_rules = get_matched_rule_ids_for_candidates(db, final, rules)
            for item in final:
                key = (
                    min(item.transaction_id, item.candidate_id),
                    max(item.transaction_id, item.candidate_id),
                )
                item.matched_rule_ids = pair_to_rules.get(key, [])

    return final


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


def _get_matching_rule_ids_for_pair(
    db: Session,
    txn: Transaction,
    cand: Transaction,
    rules: list[TransferLinkingRule],
) -> list[int]:
    """Return rule ids that match this (txn, cand) pair. txn is outflow, cand is inflow."""
    matching: list[int] = []
    for rule in rules:
        if txn.account_id != rule.source_account_id or cand.account_id != rule.target_account_id:
            continue
        if txn.amount >= 0 or cand.amount <= 0:
            continue
        day_delta = abs((txn.date - cand.date).days)
        if day_delta > rule.date_window_days:
            continue
        amount_delta = abs(abs(txn.amount) - abs(cand.amount))
        base = max(abs(txn.amount), abs(cand.amount), 1.0)
        if amount_delta > rule.amount_tolerance_abs and (
            amount_delta / base
        ) > rule.amount_tolerance_pct:
            continue
        if not transaction_matches_keywords(
            txn.merchant or "",
            txn.description or "",
            txn.raw_description or "",
            rule.source_keywords or "",
        ):
            continue
        if not transaction_matches_keywords(
            cand.merchant or "",
            cand.description or "",
            cand.raw_description or "",
            rule.target_keywords or "",
        ):
            continue
        matching.append(rule.id)
    return matching


def get_matched_rule_ids_for_candidates(
    db: Session,
    candidates: list[TransferCandidateResult],
    rules: list[TransferLinkingRule],
) -> dict[tuple[int, int], list[int]]:
    """For each (txn_id, cand_id) pair, compute which rules match."""
    pair_to_rules: dict[tuple[int, int], list[int]] = {}
    for item in candidates:
        txn = db.get(Transaction, item.transaction_id)
        cand = db.get(Transaction, item.candidate_id)
        if not txn or not cand:
            continue
        # Try both orderings (outflow, inflow)
        ids1 = _get_matching_rule_ids_for_pair(db, txn, cand, rules)
        ids2 = _get_matching_rule_ids_for_pair(db, cand, txn, rules)
        key = (min(item.transaction_id, item.candidate_id), max(item.transaction_id, item.candidate_id))
        all_ids = list(dict.fromkeys(ids1 + ids2))
        pair_to_rules[key] = all_ids
    return pair_to_rules


def apply_transfer_linking_rules(
    db: Session,
    person_id: int | None = None,
) -> dict[str, int]:
    """
    Apply transfer linking rules. Only auto-links when exactly one rule matches a pair.
    Returns dict with pairs_linked, pairs_ambiguous, pairs_no_rule.
    """
    rules = (
        db.query(TransferLinkingRule)
        .filter(TransferLinkingRule.enabled.is_(True))
        .all()
    )
    if not rules:
        return {"pairs_linked": 0, "pairs_ambiguous": 0, "pairs_no_rule": 0}

    # person_account_ids: if person_id set, restrict to that person's accounts
    person_account_ids: list[int] | None = None
    if person_id is not None:
        from app.models.account import Account

        person_account_ids = [
            r[0]
            for r in db.query(Account.id).filter(Account.person_id == person_id).all()
        ]
        if not person_account_ids:
            return {"pairs_linked": 0, "pairs_ambiguous": 0, "pairs_no_rule": 0}

    # Build map: (id_a, id_b) -> set of rule ids that match
    pair_to_rules: dict[tuple[int, int], set[int]] = {}

    for rule in rules:
        if person_account_ids and (
            rule.source_account_id not in person_account_ids
            or rule.target_account_id not in person_account_ids
        ):
            continue

        # Outflow: source_account, amount < 0, matches source_keywords
        outflows = (
            db.query(Transaction)
            .filter(
                Transaction.account_id == rule.source_account_id,
                Transaction.amount < 0,
                Transaction.is_internal_transfer.is_(False),
                Transaction.transfer_group_id.is_(None),
            )
            .all()
        )
        # Inflow: target_account, amount > 0, matches target_keywords
        inflows = (
            db.query(Transaction)
            .filter(
                Transaction.account_id == rule.target_account_id,
                Transaction.amount > 0,
                Transaction.is_internal_transfer.is_(False),
                Transaction.transfer_group_id.is_(None),
            )
            .all()
        )

        for txn_out in outflows:
            if not transaction_matches_keywords(
                txn_out.merchant or "",
                txn_out.description or "",
                txn_out.raw_description or "",
                rule.source_keywords or "",
            ):
                continue
            for txn_in in inflows:
                if not transaction_matches_keywords(
                    txn_in.merchant or "",
                    txn_in.description or "",
                    txn_in.raw_description or "",
                    rule.target_keywords or "",
                ):
                    continue
                day_delta = abs((txn_out.date - txn_in.date).days)
                if day_delta > rule.date_window_days:
                    continue
                amount_delta = abs(abs(txn_out.amount) - abs(txn_in.amount))
                base = max(abs(txn_out.amount), abs(txn_in.amount), 1.0)
                if amount_delta > rule.amount_tolerance_abs and (
                    amount_delta / base
                ) > rule.amount_tolerance_pct:
                    continue
                key = (
                    min(txn_out.id, txn_in.id),
                    max(txn_out.id, txn_in.id),
                )
                pair_to_rules.setdefault(key, set()).add(rule.id)

    pairs_linked = 0
    pairs_ambiguous = 0
    used_ids: set[int] = set()

    for (id_a, id_b), matching_rule_ids in pair_to_rules.items():
        if id_a in used_ids or id_b in used_ids:
            continue
        if len(matching_rule_ids) == 1:
            rule_id = next(iter(matching_rule_ids))
            try:
                link_transfer_pair(
                    db,
                    id_a,
                    id_b,
                    confidence=1.0,
                    source=f"rule:{rule_id}",
                )
                pairs_linked += 1
                used_ids.add(id_a)
                used_ids.add(id_b)
            except ValueError:
                pairs_ambiguous += 1
        else:
            pairs_ambiguous += 1

    return {
        "pairs_linked": pairs_linked,
        "pairs_ambiguous": pairs_ambiguous,
        "pairs_no_rule": 0,
    }


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
