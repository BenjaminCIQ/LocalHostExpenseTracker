from __future__ import annotations

from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.services.analytics_service import AnalyticsFilters, build_filtered_query


def detect_recurring_transactions(
    db: Session,
    filters: AnalyticsFilters,
    min_occurrences: int = 3,
) -> list[dict]:
    q = (
        build_filtered_query(db, filters)
        .with_entities(Transaction.id, Transaction.date, Transaction.amount, Transaction.merchant)
        .order_by(Transaction.date.asc())
        .all()
    )
    by_merchant: dict[str, list[tuple[int, date, float]]] = defaultdict(list)
    for txn_id, txn_date, amount, merchant in q:
        key = (merchant or "").strip().lower()
        if not key:
            continue
        by_merchant[key].append((txn_id, txn_date, float(amount)))

    out: list[dict] = []
    for merchant, rows in by_merchant.items():
        if len(rows) < min_occurrences:
            continue
        intervals: list[int] = []
        for idx in range(1, len(rows)):
            intervals.append((rows[idx][1] - rows[idx - 1][1]).days)
        if not intervals:
            continue
        avg_interval = sum(intervals) / len(intervals)
        if not (24 <= avg_interval <= 38):
            continue
        avg_amount = sum(abs(r[2]) for r in rows) / len(rows)
        out.append(
            {
                "merchant": merchant.title(),
                "occurrences": len(rows),
                "avg_interval_days": round(avg_interval, 1),
                "avg_amount": round(avg_amount, 2),
                "last_seen": str(rows[-1][1]),
                "transaction_ids": [r[0] for r in rows],
            }
        )
    out.sort(key=lambda x: x["avg_amount"], reverse=True)
    return out
