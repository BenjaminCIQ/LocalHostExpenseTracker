from pydantic import BaseModel


class CategorySpend(BaseModel):
    category_id: int
    category_name: str
    total: float
    count: int


class ClassificationStats(BaseModel):
    total_transactions: int
    classified: int
    unclassified: int
    auto_classified: int
    manually_classified: int


class DashboardResponse(BaseModel):
    total_income: float
    total_expenses: float
    net: float
    spending_by_category: list[CategorySpend]
    classification_stats: ClassificationStats
