from datetime import date
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.external_account import ExternalFundingLink
from app.models.transaction import Transaction
from app.schemas.dashboard import (
    CategorySpend,
    ClassificationStats,
    DashboardResponse,
    MonthlyBreakdownResponse,
    MonthlyTotals,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    account_id: int | None = None,
    person_id: int | None = None,
    month: str | None = Query(None, description="Optional YYYY-MM filter"),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.is_deleted.is_(False))
    query = query.filter(Transaction.is_internal_transfer.is_(False))
    external_linked = (
        db.query(ExternalFundingLink.transaction_id)
        .filter(ExternalFundingLink.transaction_id == Transaction.id)
        .exists()
    )
    query = query.filter(~external_linked)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if person_id is not None:
        query = query.join(Account, Transaction.account_id == Account.id).filter(
            Account.person_id == person_id
        )
    if month is not None:
        if not re.fullmatch(r"\d{4}-\d{2}", month):
            raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")
        y, m = month.split("-")
        year = int(y)
        mon = int(m)
        if mon < 1 or mon > 12:
            raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")
        start = date(year, mon, 1)
        end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
        query = query.filter(Transaction.date >= start, Transaction.date < end)

    total_income = (
        query.filter(Transaction.amount > 0)
        .with_entities(func.coalesce(func.sum(Transaction.amount), 0.0))
        .scalar()
    )
    total_expenses = abs(
        query.filter(Transaction.amount < 0)
        .with_entities(func.coalesce(func.sum(Transaction.amount), 0.0))
        .scalar()
    )

    category_rows = (
        query.filter(Transaction.final_category_id.isnot(None))
        .join(Category, Transaction.final_category_id == Category.id)
        .group_by(Category.id, Category.name)
        .with_entities(
            Category.id,
            Category.name,
            func.sum(Transaction.amount),
            func.count(Transaction.id),
        )
        .all()
    )
    spending_by_category = [
        CategorySpend(
            category_id=row[0],
            category_name=row[1],
            total=round(float(row[2]), 2),
            count=row[3],
        )
        for row in category_rows
    ]

    total = query.count()
    classified = query.filter(Transaction.final_category_id.isnot(None)).count()
    auto = query.filter(
        Transaction.classification_source != "human",
        Transaction.classification_source.isnot(None),
        Transaction.final_category_id.isnot(None),
    ).count()

    return DashboardResponse(
        total_income=round(float(total_income), 2),
        total_expenses=round(total_expenses, 2),
        net=round(float(total_income) - total_expenses, 2),
        spending_by_category=spending_by_category,
        classification_stats=ClassificationStats(
            total_transactions=total,
            classified=classified,
            unclassified=total - classified,
            auto_classified=auto,
            manually_classified=classified - auto,
        ),
    )


@router.get("/monthly", response_model=MonthlyBreakdownResponse)
def get_monthly_breakdown(
    months: int = Query(6, ge=1, le=36),
    account_id: int | None = None,
    person_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Return monthly income/expense totals for the last N months (including current month)."""
    today = date.today()
    # Build month starts for N months back.
    starts: list[date] = []
    y, m = today.year, today.month
    for _ in range(months):
        starts.append(date(y, m, 1))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    starts = list(reversed(starts))

    tx_query = db.query(Transaction).filter(Transaction.is_deleted.is_(False))
    tx_query = tx_query.filter(Transaction.is_internal_transfer.is_(False))
    external_linked = (
        db.query(ExternalFundingLink.transaction_id)
        .filter(ExternalFundingLink.transaction_id == Transaction.id)
        .exists()
    )
    tx_query = tx_query.filter(~external_linked)
    if account_id is not None:
        tx_query = tx_query.filter(Transaction.account_id == account_id)
    if person_id is not None:
        tx_query = tx_query.join(Account, Transaction.account_id == Account.id).filter(
            Account.person_id == person_id
        )

    out: list[MonthlyTotals] = []
    def _add_month(d: date) -> date:
        if d.month == 12:
            return date(d.year + 1, 1, 1)
        return date(d.year, d.month + 1, 1)

    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else _add_month(date(today.year, today.month, 1))
        q = tx_query.filter(Transaction.date >= start, Transaction.date < end)
        income = (
            q.filter(Transaction.amount > 0)
            .with_entities(func.coalesce(func.sum(Transaction.amount), 0.0))
            .scalar()
        )
        expenses = abs(
            q.filter(Transaction.amount < 0)
            .with_entities(func.coalesce(func.sum(Transaction.amount), 0.0))
            .scalar()
        )
        month_key = f"{start.year:04d}-{start.month:02d}"
        out.append(
            MonthlyTotals(
                month=month_key,
                income=round(float(income), 2),
                expenses=round(float(expenses), 2),
                net=round(float(income) - float(expenses), 2),
            )
        )

    return MonthlyBreakdownResponse(months=out)
