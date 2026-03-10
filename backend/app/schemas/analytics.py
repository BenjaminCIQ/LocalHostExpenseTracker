from pydantic import BaseModel


class CategoryAmount(BaseModel):
    category_id: int
    category_name: str
    total: float


class TimeseriesPoint(BaseModel):
    period: str
    income: float
    expenses: float
    net: float
    categories: list[CategoryAmount]


class TimeseriesResponse(BaseModel):
    points: list[TimeseriesPoint]


class TrendPoint(BaseModel):
    period: str
    total: float
    mom_change_pct: float | None = None
    rolling_avg_3m: float | None = None


class DayOfWeekBucket(BaseModel):
    day: str
    count: int
    total: float
    avg_amount: float


class AmountBucket(BaseModel):
    range_label: str
    min: float
    max: float
    count: int
    total: float


class MerchantSpend(BaseModel):
    merchant: str
    count: int
    total_spend: float
    avg_amount: float


class SpendingHabitsSummary(BaseModel):
    total_spend: float
    transaction_count: int
    avg_amount: float
    median_amount: float
    min_amount: float
    max_amount: float
    stddev_amount: float
    avg_transactions_per_month: float
    first_transaction_date: str | None
    last_transaction_date: str | None


class SpendingHabitsResponse(BaseModel):
    summary: SpendingHabitsSummary
    monthly_trend: list[TrendPoint]
    day_of_week: list[DayOfWeekBucket]
    amount_distribution: list[AmountBucket]
    top_merchants: list[MerchantSpend]
    trend_direction: str
    trend_slope: float
    proportion_of_total: float
    category_rank: int | None = None
    category_rank_total: int | None = None
    projected_annual_spend: float | None = None


class SankeyNode(BaseModel):
    id: str
    label: str


class SankeyLink(BaseModel):
    source: str
    target: str
    value: float


class SankeyResponse(BaseModel):
    nodes: list[SankeyNode]
    links: list[SankeyLink]


class CategoryBreakdownItem(BaseModel):
    category_id: int
    category_name: str
    total: float
    count: int


class CategoryBreakdownResponse(BaseModel):
    items: list[CategoryBreakdownItem]


class MerchantRankingItem(BaseModel):
    merchant: str
    total_spend: float
    count: int


class MerchantRankingResponse(BaseModel):
    items: list[MerchantRankingItem]


class OutlierItem(BaseModel):
    transaction_id: int
    date: str
    amount: float
    merchant: str
    description: str
    category_id: int | None
    category_name: str | None
    score: float
    reason: str


class OutlierResponse(BaseModel):
    items: list[OutlierItem]


class NetWorthItem(BaseModel):
    account_id: int
    account_name: str
    account_group: str
    balance: float


class ExternalNetWorthItem(BaseModel):
    external_account_id: int
    account_name: str
    account_group: str
    latest_value: float
    linked_funding_total: float
    unlinked_component: float | None


class ExternalReconciliationSummary(BaseModel):
    linked_total: float
    latest_value_total: float
    unlinked_total: float


class NetWorthResponse(BaseModel):
    items: list[NetWorthItem]
    totals_by_group: dict[str, float]
    external_items: list[ExternalNetWorthItem] = []
    external_totals_by_group: dict[str, float] = {}
    external_reconciliation_summary: ExternalReconciliationSummary | None = None
