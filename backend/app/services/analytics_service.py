from __future__ import annotations

from dataclasses import dataclass
from datetime import date

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
    include_transfers: bool | None = None
    trip_id: int | None = None


class AnalyticsQueryBuilder:
    def __init__(self, db: Session):
        self.db = db
        self._query: Query = db.query(Transaction)

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

    def build(self) -> Query:
        return self._query


def build_filtered_query(db: Session, filters: AnalyticsFilters) -> Query:
    return (
        AnalyticsQueryBuilder(db)
        .filter_date_range(filters.start_date, filters.end_date)
        .filter_person(filters.person_id)
        .filter_account(filters.account_id)
        .filter_categories(filters.category_ids)
        .filter_transfers(filters.include_transfers)
        .filter_trip(filters.trip_id)
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
