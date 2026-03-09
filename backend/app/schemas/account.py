from datetime import datetime

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    bank_name: str = ""
    account_type: str = "checking"
    currency: str = "EUR"
    owner: str = ""
    person_id: int | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    bank_name: str | None = None
    account_type: str | None = None
    currency: str | None = None
    owner: str | None = None
    person_id: int | None = None


class AccountRead(BaseModel):
    id: int
    name: str
    bank_name: str
    account_type: str
    currency: str
    owner: str
    person_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
