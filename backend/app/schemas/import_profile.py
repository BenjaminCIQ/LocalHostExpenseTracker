import json

from pydantic import BaseModel, Field


class ImportProfileBase(BaseModel):
    name: str
    format: str = "csv"
    delimiter: str | None = None

    date_column: str
    amount_column: str
    currency_column: str | None = None

    merchant_columns: list[str] = Field(default_factory=list)
    description_columns: list[str] = Field(default_factory=list)

    enabled: bool = True


class ImportProfileCreate(ImportProfileBase):
    pass


class ImportProfileUpdate(BaseModel):
    name: str | None = None
    delimiter: str | None = None
    date_column: str | None = None
    amount_column: str | None = None
    currency_column: str | None = None
    merchant_columns: list[str] | None = None
    description_columns: list[str] | None = None
    enabled: bool | None = None


class ImportProfileRead(ImportProfileBase):
    id: int

    model_config = {"from_attributes": True}


def columns_to_json(cols: list[str]) -> str:
    return json.dumps([c for c in cols if c and c.strip()])


def json_to_columns(value: str) -> list[str]:
    try:
        decoded = json.loads(value or "[]")
        if isinstance(decoded, list):
            return [str(x) for x in decoded]
    except Exception:
        pass
    return []

