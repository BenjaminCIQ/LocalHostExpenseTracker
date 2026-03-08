from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.transaction import Transaction

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])


@router.get("/uncategorized-titles")
def uncategorized_titles(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Suggest rule names based on unclassified transactions.

    Returns a list of short strings derived from merchant/description of
    transactions where final_category_id is NULL.
    """
    rows = (
        db.query(
            func.trim(Transaction.merchant).label("merchant"),
            func.trim(Transaction.description).label("description"),
        )
        .filter(Transaction.final_category_id.is_(None))
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(2000)
        .all()
    )

    seen: set[str] = set()
    out: list[str] = []
    for merchant, desc in rows:
        candidates = []
        if merchant:
            candidates.append(merchant)
        if desc:
            candidates.append(desc)

        for c in candidates:
            title = str(c).strip()
            if not title:
                continue
            title = title[:80]
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(title)
            if len(out) >= limit:
                return out

    return out

