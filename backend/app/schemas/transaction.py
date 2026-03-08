from datetime import date, datetime

from pydantic import BaseModel


class TransactionRead(BaseModel):
    id: int
    account_id: int
    date: date
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
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionClassify(BaseModel):
    category_id: int
    merchant: str | None = None


class TransactionUpdate(BaseModel):
    merchant: str | None = None
    description: str | None = None


class TransactionListResponse(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class ImportResult(BaseModel):
    batch_id: int
    filename: str
    transactions_imported: int
    duplicates_skipped: int
    account_id: int
