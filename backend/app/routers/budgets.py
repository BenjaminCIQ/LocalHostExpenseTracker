from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.budget import BudgetCreate, BudgetRead, BudgetStatus, BudgetUpdate

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


@router.get("/", response_model=list[BudgetRead])
def list_budgets(db: Session = Depends(get_db)):
    return db.query(Budget).order_by(Budget.id.desc()).all()


@router.post("/", response_model=BudgetRead, status_code=201)
def create_budget(payload: BudgetCreate, db: Session = Depends(get_db)):
    if payload.category_id is not None and db.get(Category, payload.category_id) is None:
        raise HTTPException(status_code=404, detail="Category not found")
    budget = Budget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.patch("/{budget_id}", response_model=BudgetRead)
def update_budget(budget_id: int, payload: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] is not None:
        if db.get(Category, data["category_id"]) is None:
            raise HTTPException(status_code=404, detail="Category not found")
    for k, v in data.items():
        setattr(budget, k, v)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return {"deleted": True}


@router.get("/status", response_model=list[BudgetStatus])
def budget_status(db: Session = Depends(get_db)):
    today = date.today()
    month_start = date(today.year, today.month, 1)
    budgets = db.query(Budget).filter(Budget.is_active.is_(True)).all()
    out: list[BudgetStatus] = []
    for budget in budgets:
        tx_query = db.query(Transaction).filter(Transaction.amount < 0)
        if budget.period == "monthly":
            tx_query = tx_query.filter(Transaction.date >= month_start, Transaction.date <= today)
        if budget.category_id is not None:
            tx_query = tx_query.filter(Transaction.final_category_id == budget.category_id)
        spent = float(tx_query.with_entities(func.coalesce(func.sum(-Transaction.amount), 0.0)).scalar() or 0.0)
        limit = float(budget.amount_limit)
        ratio = spent / limit if limit > 0 else 0.0
        category_name = None
        if budget.category_id is not None:
            cat = db.get(Category, budget.category_id)
            category_name = cat.name if cat else None
        out.append(
            BudgetStatus(
                budget_id=budget.id,
                name=budget.name,
                category_id=budget.category_id,
                category_name=category_name,
                amount_limit=round(limit, 2),
                spent=round(spent, 2),
                remaining=round(limit - spent, 2),
                ratio=round(ratio, 4),
                period=budget.period,
            )
        )
    return out
