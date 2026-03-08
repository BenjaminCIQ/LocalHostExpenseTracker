from dataclasses import dataclass

try:
    from rapidfuzz import fuzz as _rapidfuzz_fuzz  # type: ignore
except Exception:  # pragma: no cover
    _rapidfuzz_fuzz = None

from difflib import SequenceMatcher
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ml.preprocessor import preprocess_text
from app.models.transaction import Transaction


@dataclass(frozen=True)
class SimilarTransaction:
    transaction_id: int
    merchant: str
    description: str
    amount: float
    date: str
    score: float
    reason: str
    predicted_category_id: int | None
    final_category_id: int | None


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


def find_similar_unclassified(
    db: Session,
    seed_transaction_id: int,
    *,
    limit: int = 25,
    min_score: int = 80,
) -> list[SimilarTransaction]:
    seed = db.get(Transaction, seed_transaction_id)
    if seed is None:
        raise ValueError("Seed transaction not found")

    seed_merchant = (seed.merchant or "").strip()
    if not seed_merchant:
        return []

    seed_text = preprocess_text(seed.raw_description or seed.description or "")
    if not seed_text:
        return []

    # Candidate pool: same merchant (case-insensitive), not yet finally classified.
    candidates = (
        db.query(Transaction)
        .filter(
            Transaction.id != seed.id,
            Transaction.final_category_id.is_(None),
            func.lower(Transaction.merchant) == seed_merchant.lower(),
        )
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(2000)
        .all()
    )

    scored: list[SimilarTransaction] = []
    for c in candidates:
        c_text = preprocess_text(c.raw_description or c.description or "")
        if not c_text:
            continue
        score = _token_set_ratio(seed_text, c_text)
        if score < min_score:
            continue
        scored.append(
            SimilarTransaction(
                transaction_id=c.id,
                merchant=c.merchant,
                description=c.description,
                amount=float(c.amount),
                date=str(c.date),
                score=score,
                reason="merchant_exact+token_set_ratio",
                predicted_category_id=c.predicted_category_id,
                final_category_id=c.final_category_id,
            )
        )

    scored.sort(key=lambda x: (x.score, x.transaction_id), reverse=True)
    return scored[:limit]

