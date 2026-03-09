from dataclasses import dataclass
import re
import unicodedata

try:
    from rapidfuzz import fuzz as _rapidfuzz_fuzz  # type: ignore
except Exception:  # pragma: no cover
    _rapidfuzz_fuzz = None

from difflib import SequenceMatcher
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ml.preprocessor import preprocess_text
from app.models.merchant_memory import MerchantAlias
from app.models.transaction import Transaction
from app.services.payment_operator import detect_payment_operator

_NOISE_TOKENS = {
    "kartenzahlung",
    "card",
    "payment",
    "sepa",
    "lastschrift",
    "invoice",
    "reference",
    "ref",
    "txn",
    "pos",
    "ec",
    "debit",
    "credit",
    "transfer",
}


@dataclass(frozen=True)
class SimilarTransaction:
    transaction_id: int
    merchant: str
    description: str
    amount: float
    date: str
    score: float
    reason: str
    reasons: list[str]
    matched_fields: list[str]
    is_classified: bool
    predicted_category_id: int | None
    final_category_id: int | None


def normalize_match_text(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[\W_]+", " ", text)
    text = re.sub(r"\b\d{2,}\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_merchant(value: str | None) -> str:
    text = normalize_match_text(value)
    if not text:
        return ""
    tokens = [t for t in text.split() if t not in _NOISE_TOKENS and len(t) > 1]
    return " ".join(tokens)


def _amount_similarity(seed_amount: float, candidate_amount: float) -> float:
    seed_abs = abs(float(seed_amount))
    cand_abs = abs(float(candidate_amount))
    if seed_abs == 0 and cand_abs == 0:
        return 100.0
    if seed_abs == 0 or cand_abs == 0:
        return 0.0
    delta = abs(seed_abs - cand_abs)
    ratio = min(delta / max(seed_abs, cand_abs), 1.0)
    return max(0.0, 100.0 * (1.0 - ratio))


def _build_alias_map(db: Session) -> dict[str, str]:
    rows = db.query(MerchantAlias).all()
    return {
        normalize_merchant(row.normalized_source): row.canonical_merchant
        for row in rows
        if normalize_merchant(row.normalized_source)
    }


def _canonical_merchant(merchant: str, alias_map: dict[str, str]) -> str:
    normalized = normalize_merchant(merchant)
    if not normalized:
        return ""
    canonical = alias_map.get(normalized, merchant)
    return normalize_merchant(canonical)


def _candidate_query(db: Session, seed: Transaction, *, only_unclassified: bool):
    q = db.query(Transaction).filter(Transaction.id != seed.id)
    if only_unclassified:
        q = q.filter(Transaction.final_category_id.is_(None))

    seed_operator = detect_payment_operator(
        seed.merchant, seed.raw_description, seed.description
    )
    seed_merchant = normalize_merchant(seed.merchant)
    seed_text = normalize_match_text(
        seed.raw_description or seed.description or seed.raw_row_line or ""
    )
    seed_tokens = [token for token in seed_text.split() if len(token) >= 4][:3]

    if seed_operator:
        like = f"%{seed_operator.lower()}%"
        q = q.filter(
            func.lower(Transaction.merchant).like(like)
            | func.lower(Transaction.raw_description).like(like)
            | func.lower(Transaction.description).like(like)
        )
    elif seed_merchant:
        seed_first = seed_merchant.split()[0]
        like = f"%{seed_first}%"
        q = q.filter(
            func.lower(Transaction.merchant).like(like)
            | func.lower(Transaction.raw_description).like(like)
            | func.lower(Transaction.description).like(like)
        )
    elif seed_tokens:
        filter_expr = None
        for token in seed_tokens:
            token_like = f"%{token}%"
            term = (
                func.lower(Transaction.raw_description).like(token_like)
                | func.lower(Transaction.description).like(token_like)
            )
            filter_expr = term if filter_expr is None else (filter_expr | term)
        if filter_expr is not None:
            q = q.filter(filter_expr)

    return q


def _token_set_ratio_fallback(a: str, b: str) -> float:
    a_tokens = set(a.split())
    b_tokens = set(b.split())
    if not a_tokens or not b_tokens:
        return 0.0
    common = " ".join(sorted(a_tokens & b_tokens))
    a_only = " ".join(sorted(a_tokens - b_tokens))
    b_only = " ".join(sorted(b_tokens - a_tokens))

    # Compare common vs. the union-like strings to be more robust to token order/noise.
    s1 = (common + " " + a_only).strip()
    s2 = (common + " " + b_only).strip()
    return 100.0 * SequenceMatcher(None, s1, s2).ratio()


def _token_set_ratio(a: str, b: str) -> float:
    if _rapidfuzz_fuzz is not None:
        return float(_rapidfuzz_fuzz.token_set_ratio(a, b))
    return _token_set_ratio_fallback(a, b)


def learn_merchant_alias(db: Session, source_value: str, canonical_value: str) -> None:
    source = normalize_merchant(source_value)
    canonical = canonical_value.strip()
    if not source or not canonical:
        return

    existing = (
        db.query(MerchantAlias)
        .filter(MerchantAlias.normalized_source == source)
        .one_or_none()
    )
    if existing is None:
        db.add(
            MerchantAlias(
                normalized_source=source,
                canonical_merchant=canonical[:200],
                count=1,
                confidence=1.0,
            )
        )
        return

    if existing.canonical_merchant == canonical:
        existing.count += 1
        existing.confidence = min(1.0, existing.confidence + 0.05)
    else:
        existing.canonical_merchant = canonical[:200]
        existing.count = 1
        existing.confidence = 0.6
    db.add(existing)


def _find_similar_internal(
    db: Session,
    seed_transaction_id: int,
    *,
    limit: int,
    min_score: int,
    only_unclassified: bool,
) -> list[SimilarTransaction]:
    seed = db.get(Transaction, seed_transaction_id)
    if seed is None:
        raise ValueError("Seed transaction not found")

    seed_text = normalize_match_text(
        preprocess_text(seed.raw_description or seed.description or seed.raw_row_line or "")
    )
    seed_merchant = normalize_merchant(seed.merchant)
    seed_operator = detect_payment_operator(
        seed.merchant, seed.raw_description, seed.description
    )
    alias_map = _build_alias_map(db)
    seed_canonical = _canonical_merchant(seed.merchant or "", alias_map)

    if not seed_text and not seed_merchant:
        return []

    q = _candidate_query(db, seed, only_unclassified=only_unclassified)
    candidates = (
        q.order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(4000)
        .all()
    )

    scored: list[SimilarTransaction] = []
    for c in candidates:
        c_text = normalize_match_text(
            preprocess_text(c.raw_description or c.description or c.raw_row_line or "")
        )
        c_merchant = normalize_merchant(c.merchant)
        c_canonical = _canonical_merchant(c.merchant or "", alias_map)

        text_score = _token_set_ratio(seed_text, c_text) if seed_text and c_text else 0.0
        merchant_score = (
            _token_set_ratio(seed_merchant, c_merchant)
            if seed_merchant and c_merchant
            else 0.0
        )
        amount_score = _amount_similarity(float(seed.amount), float(c.amount))

        reasons: list[str] = []
        matched_fields: list[str] = []

        if text_score >= 70:
            reasons.append("description_fuzzy")
            matched_fields.append("description")
        if merchant_score >= 70:
            reasons.append("merchant_fuzzy")
            matched_fields.append("merchant")
        if amount_score >= 90:
            reasons.append("amount_close")
            matched_fields.append("amount")
        if seed_operator and (
            seed_operator.lower() in (c.merchant or "").lower()
            or seed_operator.lower() in (c.raw_description or "").lower()
            or seed_operator.lower() in (c.description or "").lower()
        ):
            reasons.append(f"operator({seed_operator})")
            matched_fields.append("operator")
        if seed_canonical and c_canonical and seed_canonical == c_canonical:
            reasons.append("canonical_merchant_match")
            matched_fields.append("canonical_merchant")
            merchant_score = max(merchant_score, 95.0)

        total_score = (text_score * 0.5) + (merchant_score * 0.35) + (amount_score * 0.15)
        if "canonical_merchant_match" in reasons:
            total_score = min(100.0, total_score + 5.0)
        if total_score < min_score:
            continue

        reason = "+".join(reasons) if reasons else "fuzzy_match"
        scored.append(
            SimilarTransaction(
                transaction_id=c.id,
                merchant=c.merchant,
                description=c.description,
                amount=float(c.amount),
                date=str(c.date),
                score=total_score,
                reason=reason,
                reasons=reasons,
                matched_fields=matched_fields,
                is_classified=c.final_category_id is not None,
                predicted_category_id=c.predicted_category_id,
                final_category_id=c.final_category_id,
            )
        )

    scored.sort(key=lambda x: (x.score, x.transaction_id), reverse=True)
    return scored[:limit]


def find_similar_unclassified(
    db: Session,
    seed_transaction_id: int,
    *,
    limit: int = 25,
    min_score: int = 80,
) -> list[SimilarTransaction]:
    return _find_similar_internal(
        db,
        seed_transaction_id,
        limit=limit,
        min_score=min_score,
        only_unclassified=True,
    )


def find_similar(
    db: Session,
    seed_transaction_id: int,
    *,
    limit: int = 25,
    min_score: int = 80,
    only_unclassified: bool = True,
) -> list[SimilarTransaction]:
    return _find_similar_internal(
        db,
        seed_transaction_id,
        limit=limit,
        min_score=min_score,
        only_unclassified=only_unclassified,
    )

