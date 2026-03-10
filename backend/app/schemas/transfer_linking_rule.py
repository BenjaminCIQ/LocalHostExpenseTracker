from datetime import datetime

from pydantic import BaseModel


class TransferLinkingRuleCreate(BaseModel):
    name: str
    source_account_id: int
    target_account_id: int
    source_keywords: str = ""
    target_keywords: str = ""
    date_window_days: int = 3
    amount_tolerance_abs: float = 0.01
    amount_tolerance_pct: float = 0.01
    enabled: bool = True


class TransferLinkingRuleUpdate(BaseModel):
    name: str | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    source_keywords: str | None = None
    target_keywords: str | None = None
    date_window_days: int | None = None
    amount_tolerance_abs: float | None = None
    amount_tolerance_pct: float | None = None
    enabled: bool | None = None


class TransferLinkingRuleRead(BaseModel):
    id: int
    name: str
    source_account_id: int
    target_account_id: int
    source_keywords: str
    target_keywords: str
    date_window_days: int
    amount_tolerance_abs: float
    amount_tolerance_pct: float
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplyRulesResponse(BaseModel):
    pairs_linked: int
    pairs_ambiguous: int
    pairs_no_rule: int
