from datetime import date as dt_date, datetime

from pydantic import BaseModel, Field, model_validator


class TripBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: dt_date
    end_date: dt_date
    destination: str | None = None
    notes: str | None = None
    default_category_id: int | None = None

    @model_validator(mode="after")
    def _validate_window(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: dt_date | None = None
    end_date: dt_date | None = None
    destination: str | None = None
    notes: str | None = None
    default_category_id: int | None = None


class TripRead(TripBase):
    id: int
    created_at: datetime
    overrides_count: int = 0

    model_config = {"from_attributes": True}


class TripOverrideUpsert(BaseModel):
    transaction_id: int
    include: bool


class TripTransactionItem(BaseModel):
    id: int
    date: dt_date
    amount: float
    merchant: str
    description: str
    raw_description: str
    currency: str
    final_category_id: int | None
    final_category_name: str | None = None
    predicted_category_id: int | None
    predicted_category_name: str | None = None
    membership: str  # include | exclude
    membership_source: str  # auto | manual_override | suggestion_applied
    suggested_membership: str | None = None  # include | exclude | review
    suggestion_score: float | None = None
    suggestion_reasons: list[str] = Field(default_factory=list)


class TripTransactionsResponse(BaseModel):
    items: list[TripTransactionItem]
    total: int


class TripMembershipSuggestionRead(BaseModel):
    transaction_id: int
    suggested_membership: str
    score: float
    reasons: list[str]
    is_applied: bool


class TripSuggestionRecomputeResponse(BaseModel):
    created_or_updated: int
    skipped_manual_overrides: int


class TripSuggestionApplyRequest(BaseModel):
    transaction_ids: list[int] | None = None
    bucket: str | None = None  # include | exclude | review
    apply_bucket: bool = False
    include_review_as: str | None = None  # include | exclude


class TripSuggestionApplyResponse(BaseModel):
    applied: int
    skipped: int


class TripSuggestionResetRequest(BaseModel):
    only_unapplied: bool = True


class TripSuggestionResetResponse(BaseModel):
    removed: int

