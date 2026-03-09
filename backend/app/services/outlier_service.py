from __future__ import annotations

from statistics import quantiles

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction
from app.services.analytics_service import AnalyticsFilters, build_filtered_query


def _iqr_bounds(values: list[float]) -> tuple[float, float]:
    if len(values) < 4:
        avg = sum(values) / max(len(values), 1)
        return avg * 0.25, avg * 2.0
    q1, _, q3 = quantiles(values, n=4, method="inclusive")
    iqr = q3 - q1
    return q1 - 1.5 * iqr, q3 + 1.5 * iqr


def detect_outliers(db: Session, filters: AnalyticsFilters, limit: int = 50) -> list[dict]:
    q = (
        build_filtered_query(db, filters)
        .join(Category, Transaction.final_category_id == Category.id, isouter=True)
        .with_entities(
            Transaction.id,
            Transaction.date,
            Transaction.amount,
            Transaction.merchant,
            Transaction.description,
            Category.id,
            Category.name,
        )
        .all()
    )
    by_category: dict[int | None, list[tuple]] = {}
    for row in q:
        by_category.setdefault(row[5], []).append(row)

    outliers: list[dict] = []
    for category_id, rows in by_category.items():
        amounts = [abs(float(r[2])) for r in rows]
        if len(amounts) < 5:
            continue
        low, high = _iqr_bounds(amounts)
        midpoint = (low + high) / 2 if high > low else high
        for r in rows:
            amount_abs = abs(float(r[2]))
            if amount_abs > high:
                score = amount_abs / max(midpoint, 1.0)
                outliers.append(
                    {
                        "transaction_id": int(r[0]),
                        "date": str(r[1]),
                        "amount": round(float(r[2]), 2),
                        "merchant": r[3] or "",
                        "description": r[4] or "",
                        "category_id": category_id,
                        "category_name": r[6] if r[6] else None,
                        "score": round(score, 2),
                        "reason": f"Above typical range ({round(high, 2)}) for this category",
                    }
                )

    outliers.sort(key=lambda o: o["score"], reverse=True)
    return outliers[:limit]
