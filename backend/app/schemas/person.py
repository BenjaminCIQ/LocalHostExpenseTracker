from datetime import datetime

from pydantic import BaseModel


class PersonCreate(BaseModel):
    name: str
    icon_id: str | None = None


class PersonUpdate(BaseModel):
    name: str
    icon_id: str | None = None


class PersonRead(BaseModel):
    id: int
    name: str
    icon_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

