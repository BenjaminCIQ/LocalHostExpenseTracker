from datetime import datetime

from pydantic import BaseModel


class ExternalAccountCreate(BaseModel):
    name: str
    account_type: str = "investment"
    account_group: str = "asset"
    currency: str = "EUR"
    owner: str = ""
    person_id: int | None = None
    notes: str = ""
    is_active: bool = True
    ticker: str | None = None
    asset_class: str | None = None
    pricing_provider: str | None = None


class ExternalAccountUpdate(BaseModel):
    name: str | None = None
    account_type: str | None = None
    account_group: str | None = None
    currency: str | None = None
    owner: str | None = None
    person_id: int | None = None
    notes: str | None = None
    is_active: bool | None = None
    ticker: str | None = None
    asset_class: str | None = None
    pricing_provider: str | None = None


class ExternalAccountRead(BaseModel):
    id: int
    name: str
    account_type: str
    account_group: str
    currency: str
    owner: str
    person_id: int | None
    notes: str
    is_active: bool
    ticker: str | None
    asset_class: str | None
    pricing_provider: str | None
    last_price_sync_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExternalValuationSnapshotCreate(BaseModel):
    snapshot_date: datetime
    value: float
    source: str = "manual"
    confidence: float | None = None
    notes: str = ""


class ExternalValuationSnapshotRead(BaseModel):
    id: int
    external_account_id: int
    snapshot_date: datetime
    value: float
    source: str
    confidence: float | None
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExternalFundingLinkCreate(BaseModel):
    transaction_id: int
    linked_amount: float
    link_type: str = "funding_in"
    notes: str = ""
    override_validation: bool = False


class ExternalFundingLinkRead(BaseModel):
    id: int
    external_account_id: int
    transaction_id: int
    linked_amount: float
    link_type: str
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExternalReconciliationRead(BaseModel):
    external_account_id: int
    latest_value: float | None
    linked_funding_total: float
    unlinked_component: float | None
    links_count: int


class ExternalFundingSummaryRead(BaseModel):
    funding_in_total: float
    funding_out_total: float
    net_external_flow: float
    links_count: int
