from pydantic import BaseModel


class ParsingRuleCreate(BaseModel):
    name: str
    enabled: bool = True
    priority: int = 100
    import_profile_id: int | None = None
    operator_token: str | None = None
    match_regex: str
    merchant_group: int = 1


class ParsingRuleUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    priority: int | None = None
    import_profile_id: int | None = None
    operator_token: str | None = None
    match_regex: str | None = None
    merchant_group: int | None = None


class ParsingRuleRead(BaseModel):
    id: int
    name: str
    enabled: bool
    priority: int
    import_profile_id: int | None
    operator_token: str | None
    match_regex: str
    merchant_group: int

    model_config = {"from_attributes": True}


class ParsingRuleTestRequest(BaseModel):
    sample_text: str


class ParsingRuleTestResponse(BaseModel):
    matches: bool
    extracted_merchant: str | None = None

