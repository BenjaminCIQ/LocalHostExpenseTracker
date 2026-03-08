from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryTree

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order).all()


@router.get("/tree", response_model=list[CategoryTree])
def get_category_tree(db: Session = Depends(get_db)):
    all_cats = db.query(Category).order_by(Category.sort_order).all()
    by_parent: dict[int | None, list] = {}
    for cat in all_cats:
        by_parent.setdefault(cat.parent_id, []).append(cat)

    def _build(parent_id: int | None) -> list[CategoryTree]:
        children = by_parent.get(parent_id, [])
        return [
            CategoryTree(
                id=c.id,
                name=c.name,
                parent_id=c.parent_id,
                is_income=c.is_income,
                sort_order=c.sort_order,
                children=_build(c.id),
            )
            for c in children
        ]

    return _build(None)


@router.post("/", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    if payload.parent_id is not None:
        parent = db.get(Category, payload.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    cat = Category(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryCreate,
    db: Session = Depends(get_db),
):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, val in payload.model_dump().items():
        setattr(cat, key, val)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
