from datetime import datetime

from pydantic import BaseModel


class PersonCreate(BaseModel):
    name: str


class PersonUpdate(BaseModel):
    name: str


class PersonRead(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}

