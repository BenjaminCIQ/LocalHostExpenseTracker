from pydantic import BaseModel


class UserOverrideCreate(BaseModel):
    pattern: str
    category_id: int
    is_regex: bool = False
    priority: int = 0


class UserOverrideUpdate(BaseModel):
    pattern: str | None = None
    category_id: int | None = None
    is_regex: bool | None = None
    priority: int | None = None


class UserOverrideRead(BaseModel):
    id: int
    pattern: str
    category_id: int
    is_regex: bool
    priority: int

    model_config = {"from_attributes": True}


class OverrideTestRequest(BaseModel):
    description: str


class OverrideTestResponse(BaseModel):
    matches: bool

