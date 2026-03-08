from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.dashboard import (
    CategorySpend,
    ClassificationStats,
    DashboardResponse,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    account_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)

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
