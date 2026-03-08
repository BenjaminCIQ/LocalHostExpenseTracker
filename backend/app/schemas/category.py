from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None
    is_income: bool = False
    sort_order: int = 0


class CategoryRead(BaseModel):
    id: int
    name: str
    parent_id: int | None
    is_income: bool
    sort_order: int

    model_config = {"from_attributes": True}


class CategoryTree(CategoryRead):
    children: list["CategoryTree"] = []
