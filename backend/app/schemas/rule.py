from typing import Literal

from pydantic import BaseModel, Field


RuleLogic = Literal["AND", "OR"]
RuleField = Literal["description", "merchant", "amount"]
RuleOperator = Literal[
    "contains",
    "not_contains",
    "equals",
    "starts_with",
    "gt",
    "lt",
    "gte",
    "lte",
]


class RuleConditionCreate(BaseModel):
    field: RuleField
    operator: RuleOperator
    value: str = Field(min_length=1, max_length=500)


class RuleConditionRead(BaseModel):
    id: int
    rule_id: int
    field: RuleField
    operator: RuleOperator
    value: str

    model_config = {"from_attributes": True}


class RuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category_id: int
    logic: RuleLogic = "AND"
    priority: int = 0
    enabled: bool = True
    conditions: list[RuleConditionCreate] = Field(default_factory=list, min_length=1)


class RuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: int | None = None
    logic: RuleLogic | None = None
    priority: int | None = None
    enabled: bool | None = None
    conditions: list[RuleConditionCreate] | None = None


class RuleRead(BaseModel):
    id: int
    name: str
    category_id: int
    logic: RuleLogic
    priority: int
    enabled: bool
    conditions: list[RuleConditionRead]

    model_config = {"from_attributes": True}


class RuleTestRequest(BaseModel):
    description: str = ""
    merchant: str = ""
    amount: float = 0.0


class RuleTestResponse(BaseModel):
    matches: bool


class RuleToggleRequest(BaseModel):
    enabled: bool

