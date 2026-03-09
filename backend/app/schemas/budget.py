from datetime import datetime

from pydantic import BaseModel


class BudgetCreate(BaseModel):
    name: str
    category_id: int | None = None
    amount_limit: float
    period: str = "monthly"
    is_active: bool = True


class BudgetUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    amount_limit: float | None = None
    period: str | None = None
    is_active: bool | None = None


class BudgetRead(BaseModel):
    id: int
    name: str
    category_id: int | None
    amount_limit: float
    period: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetStatus(BaseModel):
    budget_id: int
    name: str
    category_id: int | None
    category_name: str | None
    amount_limit: float
    spent: float
    remaining: float
    ratio: float
    period: str
