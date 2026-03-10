from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from statistics import median

from sqlalchemy import Integer, and_, case, func, or_
from sqlalchemy.orm import Query, Session

from app.models.account import Account
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.trip import Trip, TripTransactionOverride
from app.services.external_account_service import get_external_account_summary


@dataclass
class AnalyticsFilters:
    start_date: date | None = None
    end_date: date | None = None
    account_id: int | None = None
    person_id: int | None = None
    category_ids: list[int] | None = None
    merchant_names: list[str] | None = None
    include_transfers: bool | None = None
    trip_id: int | None = None
    exclude_trip_included: bool = False
    excluded_trip_ids: list[int] | None = None


class AnalyticsQueryBuilder:
    def __init__(self, db: Session):
        self.db = db
        self._query: Query = db.query(Transaction).filter(Transaction.is_deleted.is_(False))

    def filter_date_range(self, start: date | None, end: date | None) -> "AnalyticsQueryBuilder":
        if start is not None:
            self._query = self._query.filter(Transaction.date >= start)
        if end is not None:
            self._query = self._query.filter(Transaction.date <= end)
        return self

    def filter_person(self, person_id: int | None) -> "AnalyticsQueryBuilder":
        if person_id is not None:
            self._query = self._query.join(Account, Transaction.account_id == Account.id).filter(
                Account.person_id == person_id
            )
        return self

    def filter_account(self, account_id: int | None) -> "AnalyticsQueryBuilder":
        if account_id is not None:
            self._query = self._query.filter(Transaction.account_id == account_id)
        return self

    def filter_categories(self, category_ids: list[int] | None) -> "AnalyticsQueryBuilder":
        if category_ids:
            self._query = self._query.filter(Transaction.final_category_id.in_(category_ids))
        return self

    def filter_merchants(self, merchant_names: list[str] | None) -> "AnalyticsQueryBuilder":
        if merchant_names:
            names = [name.strip().lower() for name in merchant_names if name and name.strip()]
            if names:
                self._query = self._query.filter(func.lower(Transaction.merchant).in_(names))
        return self

    def filter_transfers(self, include_transfers: bool | None) -> "AnalyticsQueryBuilder":
        if include_transfers is False:
            self._query = self._query.filter(Transaction.is_internal_transfer.is_(False))
        return self

    def filter_trip(self, trip_id: int | None) -> "AnalyticsQueryBuilder":
        if trip_id is None:
            return self
        trip = self.db.get(Trip, trip_id)
        if trip is None:
            # Keep empty result on missing trip instead of raising from service layer.
            self._query = self._query.filter(False)
            return self
        include_override = (
            self.db.query(TripTransactionOverride.id)
            .filter(
                TripTransactionOverride.trip_id == trip_id,
                TripTransactionOverride.transaction_id == Transaction.id,
                TripTransactionOverride.include.is_(True),
            )
            .exists()
        )
        exclude_override = (
            self.db.query(TripTransactionOverride.id)
            .filter(
                TripTransactionOverride.trip_id == trip_id,
                TripTransactionOverride.transaction_id == Transaction.id,
                TripTransactionOverride.include.is_(False),
            )
            .exists()
        )
        auto_in_window = and_(
            Transaction.date >= trip.start_date,
            Transaction.date <= trip.end_date,
        )
        self._query = self._query.filter(
            or_(include_override, and_(auto_in_window, ~exclude_override))
        )
        return self

    def filter_excluded_trip_included(
        self,
        exclude_trip_included: bool,
        excluded_trip_ids: list[int] | None,
    ) -> "AnalyticsQueryBuilder":
        if not exclude_trip_included:
            return self
        include_marked = self.db.query(TripTransactionOverride.id).filter(
            TripTransactionOverride.transaction_id == Transaction.id,
            TripTransactionOverride.include.is_(True),
        )
        if excluded_trip_ids:
            include_marked = include_marked.filter(
                TripTransactionOverride.trip_id.in_(excluded_trip_ids)
            )
        include_marked_exists = include_marked.exists()
        self._query = self._query.filter(~include_marked_exists)
        return self

    def build(self) -> Query:
        return self._query


def build_filtered_query(db: Session, filters: AnalyticsFilters) -> Query:
    return (
        AnalyticsQueryBuilder(db)
        .filter_date_range(filters.start_date, filters.end_date)
        .filter_person(filters.person_id)
        .filter_account(filters.account_id)
        .filter_categories(filters.category_ids)
        .filter_merchants(filters.merchant_names)
        .filter_transfers(filters.include_transfers)
        .filter_trip(filters.trip_id)
        .filter_excluded_trip_included(
            exclude_trip_included=filters.exclude_trip_included,
            excluded_trip_ids=filters.excluded_trip_ids,
        )
        .build()
    )


def _period_expr(granularity: str):
    if granularity == "daily":
        return func.strftime("%Y-%m-%d", Transaction.date)
    if granularity == "weekly":
        return func.strftime("%Y-W%W", Transaction.date)
    if granularity == "quarterly":
        year = func.strftime("%Y", Transaction.date)
        month_num = func.cast(func.strftime("%m", Transaction.date), Integer)
        q = ((month_num - 1) / 3) + 1
        return func.printf("%s-Q%d", year, func.cast(q, Integer))
    if granularity == "yearly":
        return func.strftime("%Y", Transaction.date)
    return func.strftime("%Y-%m", Transaction.date)


def get_timeseries(
    db: Session,
    filters: AnalyticsFilters,
    granularity: str = "monthly",
) -> list[dict]:
    base_query = build_filtered_query(db, filters)
    period = _period_expr(granularity).label("period")

    rows = (
        base_query.with_entities(
            period,
            func.coalesce(func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0.0)), 0.0).label("income"),
            func.coalesce(func.sum(case((Transaction.amount < 0, -Transaction.amount), else_=0.0)), 0.0).label("expenses"),
        )
        .group_by(period)
        .order_by(period.asc())
        .all()
    )

    category_rows = (
        base_query.join(Category, Transaction.final_category_id == Category.id, isouter=True)
        .with_entities(
            period,
            Category.id,
            Category.name,
            func.coalesce(func.sum(Transaction.amount), 0.0),
        )
        .group_by(period, Category.id, Category.name)
        .all()
    )

    categories_by_period: dict[str, list[dict]] = {}
    for p, cid, cname, total in category_rows:
        if cid is None:
            continue
        categories_by_period.setdefault(p, []).append(
            {
                "category_id": int(cid),
                "category_name": str(cname),
                "total": round(float(total), 2),
            }
        )

    out: list[dict] = []
    for p, income, expenses in rows:
        income_f = round(float(income), 2)
        expenses_f = round(float(expenses), 2)
        out.append(
            {
                "period": str(p),
                "income": income_f,
                "expenses": expenses_f,
                "net": round(income_f - expenses_f, 2),
                "categories": categories_by_period.get(str(p), []),
            }
        )
    return out


def get_category_breakdown(db: Session, filters: AnalyticsFilters) -> list[dict]:
    q = build_filtered_query(db, filters)
    rows = (
        q.join(Category, Transaction.final_category_id == Category.id)
        .with_entities(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Transaction.amount), 0.0),
            func.count(Transaction.id),
        )
        .group_by(Category.id, Category.name)
        .order_by(func.sum(func.abs(Transaction.amount)).desc())
        .all()
    )
    return [
        {
            "category_id": int(row[0]),
            "category_name": str(row[1]),
            "total": round(float(row[2]), 2),
            "count": int(row[3]),
        }
        for row in rows
    ]


def get_merchant_ranking(db: Session, filters: AnalyticsFilters, limit: int = 20) -> list[dict]:
    q = build_filtered_query(db, filters)
    rows = (
        q.filter(Transaction.amount < 0)
        .with_entities(
            Transaction.merchant,
            func.coalesce(func.sum(-Transaction.amount), 0.0),
            func.count(Transaction.id),
        )
        .group_by(Transaction.merchant)
        .order_by(func.sum(-Transaction.amount).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "merchant": (row[0] or "").strip() or "Unknown",
            "total_spend": round(float(row[1]), 2),
            "count": int(row[2]),
        }
        for row in rows
    ]


def get_sankey_data(db: Session, filters: AnalyticsFilters) -> dict:
    q = build_filtered_query(db, filters)
    expenses = (
        q.join(Category, Transaction.final_category_id == Category.id)
        .filter(Transaction.amount < 0)
        .with_entities(Category.id, Category.name, func.coalesce(func.sum(-Transaction.amount), 0.0))
        .group_by(Category.id, Category.name)
        .all()
    )
    incomes = (
        q.join(Category, Transaction.final_category_id == Category.id)
        .filter(Transaction.amount > 0)
        .with_entities(Category.id, Category.name, func.coalesce(func.sum(Transaction.amount), 0.0))
        .group_by(Category.id, Category.name)
        .all()
    )

    nodes = [{"id": "total_income", "label": "Total income"}]
    links: list[dict] = []

    for cid, cname, total in incomes:
        node_id = f"in_{cid}"
        nodes.append({"id": node_id, "label": f"{cname} (income)"})
        links.append({"source": node_id, "target": "total_income", "value": round(float(total), 2)})

    for cid, cname, total in expenses:
        node_id = f"out_{cid}"
        nodes.append({"id": node_id, "label": f"{cname} (expense)"})
        links.append({"source": "total_income", "target": node_id, "value": round(float(total), 2)})

    return {"nodes": nodes, "links": links}




def _round2(value: float) -> float:
    return round(float(value), 2)


def _classify_trend(slope: float, baseline: float) -> str:
    threshold = max(1.0, baseline * 0.03)
    if slope > threshold:
        return "increasing"
    if slope < -threshold:
        return "decreasing"
    return "consistent"


def _linear_regression_slope(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    xs = [float(i) for i in range(n)]
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values, strict=False))
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:
        return 0.0
    return numerator / denominator


def _amount_distribution(amounts: list[float], bucket_count: int = 8) -> list[dict]:
    if not amounts:
        return []
    minimum = min(amounts)
    maximum = max(amounts)
    if minimum == maximum:
        return [{
            "range_label": f"{_round2(minimum)}-{_round2(maximum)}",
            "min": _round2(minimum),
            "max": _round2(maximum),
            "count": len(amounts),
            "total": _round2(sum(amounts)),
        }]

    width = (maximum - minimum) / bucket_count
    buckets: list[dict] = []
    for idx in range(bucket_count):
        low = minimum + (idx * width)
        high = maximum if idx == bucket_count - 1 else low + width
        buckets.append({
            "range_label": f"{_round2(low)}-{_round2(high)}",
            "min": _round2(low),
            "max": _round2(high),
            "count": 0,
            "total": 0.0,
        })

    for amount in amounts:
        if amount == maximum:
            bucket_idx = bucket_count - 1
        else:
            bucket_idx = int((amount - minimum) / width)
            bucket_idx = min(max(bucket_idx, 0), bucket_count - 1)
        buckets[bucket_idx]["count"] += 1
        buckets[bucket_idx]["total"] += amount

    for bucket in buckets:
        bucket["total"] = _round2(bucket["total"])

    return buckets


def get_spending_habits(db: Session, filters: AnalyticsFilters) -> dict:
    q = build_filtered_query(db, filters)
    expenses_q = q.filter(Transaction.amount < 0)

    expense_rows = (
        expenses_q.with_entities(Transaction.date, Transaction.amount, Transaction.merchant)
        .order_by(Transaction.date.asc())
        .all()
    )

    amounts = [-float(row[1]) for row in expense_rows]
    tx_count = len(amounts)
    total_spend = _round2(sum(amounts))

    if tx_count:
        avg_amount = total_spend / tx_count
        med_amount = float(median(amounts))
        min_amount = min(amounts)
        max_amount = max(amounts)
        if tx_count > 1:
            variance = sum((value - avg_amount) ** 2 for value in amounts) / tx_count
            stddev = variance ** 0.5
        else:
            stddev = 0.0
        first_date = str(expense_rows[0][0])
        last_date = str(expense_rows[-1][0])
    else:
        avg_amount = 0.0
        med_amount = 0.0
        min_amount = 0.0
        max_amount = 0.0
        stddev = 0.0
        first_date = None
        last_date = None

    month_keys = sorted({row[0].strftime("%Y-%m") for row in expense_rows})
    avg_tx_per_month = (tx_count / max(len(month_keys), 1)) if tx_count else 0.0

    monthly_map: dict[str, float] = {}
    for txn_date, txn_amount, _merchant in expense_rows:
        key = txn_date.strftime("%Y-%m")
        monthly_map[key] = monthly_map.get(key, 0.0) + (-float(txn_amount))

    monthly_labels = sorted(monthly_map.keys())
    monthly_values = [monthly_map[key] for key in monthly_labels]
    slope = _linear_regression_slope(monthly_values)
    baseline = (sum(monthly_values) / len(monthly_values)) if monthly_values else 0.0
    trend_direction = _classify_trend(slope, baseline)

    monthly_trend: list[dict] = []
    rolling_window: list[float] = []
    prev_value: float | None = None
    for label in monthly_labels:
        current = monthly_map[label]
        rolling_window.append(current)
        if len(rolling_window) > 3:
            rolling_window.pop(0)
        rolling_avg = (sum(rolling_window) / len(rolling_window)) if len(rolling_window) == 3 else None

        if prev_value is None:
            mom_change_pct = None
        elif prev_value == 0:
            mom_change_pct = 100.0 if current > 0 else 0.0
        else:
            mom_change_pct = ((current - prev_value) / prev_value) * 100.0

        monthly_trend.append(
            {
                "period": label,
                "total": _round2(current),
                "mom_change_pct": None if mom_change_pct is None else _round2(mom_change_pct),
                "rolling_avg_3m": None if rolling_avg is None else _round2(rolling_avg),
            }
        )
        prev_value = current

    projected_annual_spend = None
    if monthly_values:
        projected_annual_spend = _round2((sum(monthly_values) / len(monthly_values)) * 12.0)

    day_rows = (
        expenses_q.with_entities(
            func.strftime("%w", Transaction.date).label("dow"),
            func.count(Transaction.id),
            func.coalesce(func.sum(-Transaction.amount), 0.0),
        )
        .group_by("dow")
        .all()
    )
    day_name = {"1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "0": "Sun"}
    day_map = {str(row[0]): (int(row[1]), float(row[2])) for row in day_rows}
    day_of_week = []
    for day in ["1", "2", "3", "4", "5", "6", "0"]:
        count, total = day_map.get(day, (0, 0.0))
        day_of_week.append(
            {
                "day": day_name[day],
                "count": count,
                "total": _round2(total),
                "avg_amount": _round2(total / count) if count else 0.0,
            }
        )

    merchant_rows = (
        expenses_q.with_entities(
            Transaction.merchant,
            func.count(Transaction.id),
            func.coalesce(func.sum(-Transaction.amount), 0.0),
            func.coalesce(func.avg(-Transaction.amount), 0.0),
        )
        .group_by(Transaction.merchant)
        .order_by(func.sum(-Transaction.amount).desc())
        .limit(10)
        .all()
    )
    top_merchants = [
        {
            "merchant": (row[0] or "").strip() or "Unknown",
            "count": int(row[1]),
            "total_spend": _round2(row[2]),
            "avg_amount": _round2(row[3]),
        }
        for row in merchant_rows
    ]

    base_filters = replace(filters, category_ids=None, merchant_names=None)
    baseline_total = (
        build_filtered_query(db, base_filters)
        .filter(Transaction.amount < 0)
        .with_entities(func.coalesce(func.sum(-Transaction.amount), 0.0))
        .scalar()
    )
    baseline_total_f = float(baseline_total or 0.0)
    proportion_of_total = _round2((total_spend / baseline_total_f) * 100.0) if baseline_total_f > 0 else 0.0

    category_rank: int | None = None
    category_rank_total: int | None = None
    if filters.category_ids and len(filters.category_ids) == 1:
        category_totals = (
            build_filtered_query(db, base_filters)
            .filter(Transaction.amount < 0)
            .join(Category, Transaction.final_category_id == Category.id)
            .with_entities(Category.id, func.coalesce(func.sum(-Transaction.amount), 0.0).label("total"))
            .group_by(Category.id)
            .order_by(func.sum(-Transaction.amount).desc())
            .all()
        )
        rank_map = {int(cid): idx + 1 for idx, (cid, _total) in enumerate(category_totals)}
        category_rank = rank_map.get(filters.category_ids[0])
        category_rank_total = len(category_totals)

    return {
        "summary": {
            "total_spend": total_spend,
            "transaction_count": tx_count,
            "avg_amount": _round2(avg_amount),
            "median_amount": _round2(med_amount),
            "min_amount": _round2(min_amount),
            "max_amount": _round2(max_amount),
            "stddev_amount": _round2(stddev),
            "avg_transactions_per_month": _round2(avg_tx_per_month),
            "first_transaction_date": first_date,
            "last_transaction_date": last_date,
        },
        "monthly_trend": monthly_trend,
        "day_of_week": day_of_week,
        "amount_distribution": _amount_distribution(amounts, bucket_count=8),
        "top_merchants": top_merchants,
        "trend_direction": trend_direction,
        "trend_slope": _round2(slope),
        "proportion_of_total": proportion_of_total,
        "category_rank": category_rank,
        "category_rank_total": category_rank_total,
        "projected_annual_spend": projected_annual_spend,
    }
def get_net_worth(db: Session, person_id: int | None = None) -> dict:
    account_query = db.query(Account)
    if person_id is not None:
        account_query = account_query.filter(Account.person_id == person_id)
    accounts = account_query.all()

    items: list[dict] = []
    totals_by_group: dict[str, float] = {}
    for account in accounts:
        tx_sum = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(Transaction.account_id == account.id)
            .scalar()
        )
        balance = round(float(account.starting_balance) + float(tx_sum or 0.0), 2)
        group = account.account_group or "other"
        totals_by_group[group] = round(totals_by_group.get(group, 0.0) + balance, 2)
        items.append(
            {
                "account_id": account.id,
                "account_name": account.name,
                "account_group": group,
                "balance": balance,
            }
        )

    external = get_external_account_summary(db, person_id=person_id)
    return {
        "items": items,
        "totals_by_group": totals_by_group,
        "external_items": external["items"],
        "external_totals_by_group": external["totals_by_group"],
        "external_reconciliation_summary": external["reconciliation_summary"],
    }


