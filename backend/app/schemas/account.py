from datetime import datetime

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    bank_name: str = ""
    account_type: str = "checking"
    account_group: str = "cash"
    currency: str = "EUR"
    owner: str = ""
    starting_balance: float = 0.0
    person_id: int | None = None
    icon_id: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    bank_name: str | None = None
    account_type: str | None = None
    account_group: str | None = None
    currency: str | None = None
    owner: str | None = None
    starting_balance: float | None = None
    person_id: int | None = None
    icon_id: str | None = None


class AccountRead(BaseModel):
    id: int
    name: str
    bank_name: str
    account_type: str
    account_group: str
    currency: str
    owner: str
    starting_balance: float
    person_id: int | None
    icon_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
