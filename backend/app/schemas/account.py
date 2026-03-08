from datetime import datetime

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    bank_name: str = ""
    account_type: str = "checking"
    currency: str = "EUR"
    owner: str = ""


class AccountRead(BaseModel):
    id: int
    name: str
    bank_name: str
    account_type: str
    currency: str
    owner: str
    created_at: datetime

    model_config = {"from_attributes": True}
