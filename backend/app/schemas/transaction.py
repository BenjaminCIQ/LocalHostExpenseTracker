from datetime import date as dt_date, datetime

from pydantic import BaseModel, Field


class TransactionRead(BaseModel):
    id: int
    account_id: int
    date: dt_date
    amount: float
    raw_description: str
    description: str
    merchant: str
    currency: str
    predicted_category_id: int | None
    predicted_category_name: str | None = None
    final_category_id: int | None
    final_category_name: str | None = None
    classification_source: str | None
    confidence: float | None
    transaction_kind: str
    transfer_group_id: str | None = None
    transfer_linked_transaction_id: int | None = None
    transfer_confidence: float | None = None
    transfer_match_source: str | None = None
    is_internal_transfer: bool
    is_deleted: bool = False
    deleted_at: datetime | None = None
    deleted_by_person_id: int | None = None
    delete_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionClassify(BaseModel):
    category_id: int
    merchant: str | None = None


class TransactionUpdate(BaseModel):
    merchant: str | None = None
    description: str | None = None
    raw_description: str | None = None
    date: dt_date | None = None
    amount: float | None = None
    currency: str | None = None
    transaction_kind: str | None = None
    transfer_group_id: str | None = None
    transfer_linked_transaction_id: int | None = None
    transfer_confidence: float | None = None
    transfer_match_source: str | None = None
    is_internal_transfer: bool | None = None


class TransactionManualCreate(BaseModel):
    account_id: int
    date: dt_date
    amount: float
    description: str
    merchant: str | None = None
    raw_description: str | None = None
    currency: str = "EUR"


class TransactionListResponse(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class PotentialDuplicateRead(BaseModel):
    duplicate_key: str
    rating: float
    reason: str
    existing_transaction_id: int
    incoming_date: str
    incoming_amount: float
    incoming_currency: str
    incoming_merchant: str
    incoming_description: str
    incoming_raw_description: str
    existing_date: str
    existing_amount: float
    existing_currency: str
    existing_merchant: str
    existing_description: str
    existing_raw_description: str


class ImportResult(BaseModel):
    batch_id: int
    filename: str
    transactions_imported: int
    duplicates_skipped: int
    account_id: int
    potential_duplicates: list[PotentialDuplicateRead] = Field(default_factory=list)
    duplicate_overrides_applied: int = 0


class ExistingDuplicateCandidateRead(BaseModel):
    transaction_id: int
    candidate_id: int
    account_id: int
    rating: float
    reason: str


class SimilarTransactionCandidate(BaseModel):
    transaction_id: int
    date: str
    amount: float
    merchant: str
    description: str
    score: float
    reason: str
    predicted_category_id: int | None
    final_category_id: int | None


class BulkClassifyRequest(BaseModel):
    transaction_ids: list[int]
    category_id: int
    merchant: str | None = None


class BulkClassifyResponse(BaseModel):
    updated: int
    skipped: int


class TransactionRawRead(BaseModel):
    raw_row_json: str | None
    raw_row_line: str | None

    model_config = {"from_attributes": True}


class BulkUpdateFieldsRequest(BaseModel):
    transaction_ids: list[int]
    merchant: str | None = None
    description: str | None = None
    raw_description: str | None = None
    allow_classified: bool = False
    re_predict: bool = True


class BulkUpdateFieldsResponse(BaseModel):
    updated: int
    skipped: int
    skipped_reasons: dict[str, int] = Field(default_factory=dict)
    updated_classified: int = 0


class SuggestFieldUpdateCandidate(BaseModel):
    transaction_id: int
    score: float
    reason: str
    reasons: list[str] = Field(default_factory=list)
    matched_fields: list[str] = Field(default_factory=list)
    score_components: dict[str, float] = Field(default_factory=dict)
    is_classified: bool = False
    current_merchant: str
    current_description: str
    current_raw_description: str
    suggested_merchant: str | None
    suggested_description: str | None
    suggested_raw_description: str | None
    ml_suggested_merchant: str | None = None
    ml_merchant_confidence: float | None = None
    ml_suggested_description: str | None = None
    ml_description_confidence: float | None = None


class TransferCandidate(BaseModel):
    transaction_id: int
    candidate_id: int
    transaction_date: str
    candidate_date: str
    transaction_amount: float
    candidate_amount: float
    transaction_account_id: int
    candidate_account_id: int
    transaction_currency: str
    candidate_currency: str
    score: float
    reason: str
    reasons: list[str] = Field(default_factory=list)
    transaction_description: str = ""
    candidate_description: str = ""
    transaction_raw_description: str = ""
    candidate_raw_description: str = ""
    transaction_merchant: str = ""
    candidate_merchant: str = ""
    transaction_kind: str = ""
    candidate_kind: str = ""
    transaction_is_internal_transfer: bool = False
    candidate_is_internal_transfer: bool = False
    transaction_transfer_group_id: str | None = None
    candidate_transfer_group_id: str | None = None
    matched_rule_ids: list[int] = Field(default_factory=list)


class TransferAutoLinkResponse(BaseModel):
    linked: int
    reviewed: int
    skipped: int


class TransferLinkRequest(BaseModel):
    transaction_id: int
    candidate_id: int
    confidence: float | None = None


class TransferUnlinkRequest(BaseModel):
    transaction_id: int


class TransferLinkResponse(BaseModel):
    linked: bool
    transfer_group_id: str | None
