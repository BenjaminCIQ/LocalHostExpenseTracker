from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryTree

router = APIRouter(prefix="/api/categories", tags=["categories"])

def _cat_sort_key(parent_id: int | None, c: Category):
    # All levels: alphabetical within the same parent.
    # Keep sort_order only as a stable tiebreaker.
    return (c.name.lower(), c.sort_order or 0)

def _build_tree_ordered(db: Session) -> list[CategoryTree]:
    all_cats = db.query(Category).all()
    by_parent: dict[int | None, list[Category]] = {}
    for cat in all_cats:
        by_parent.setdefault(cat.parent_id, []).append(cat)

    for k in list(by_parent.keys()):
        by_parent[k].sort(key=lambda c, parent_id=k: _cat_sort_key(parent_id, c))

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

def _flatten_tree(tree: list[CategoryTree]) -> list[CategoryTree]:
    out: list[CategoryTree] = []
    def _walk(nodes: list[CategoryTree]):
        for n in nodes:
            out.append(n)
            if n.children:
                _walk(n.children)
    _walk(tree)
    return out

def _auto_sort_order(db: Session, parent_id: int | None) -> int:
    max_sort = (
        db.query(func.max(Category.sort_order))
        .filter(Category.parent_id == parent_id)
        .scalar()
    )
    return int(max_sort + 10) if max_sort is not None else 0


@router.get("/", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    # Default order: hierarchy pre-order traversal (tree order).
    tree = _build_tree_ordered(db)
    flat = _flatten_tree(tree)
    return [
        CategoryRead(
            id=c.id,
            name=c.name,
            parent_id=c.parent_id,
            is_income=c.is_income,
            sort_order=c.sort_order,
        )
        for c in flat
    ]


@router.get("/tree", response_model=list[CategoryTree])
def get_category_tree(db: Session = Depends(get_db)):
    return _build_tree_ordered(db)


@router.post("/", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="Category name already exists"
        )
    if payload.parent_id is not None:
        parent = db.get(Category, payload.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    data = payload.model_dump()
    if data.get("sort_order") is None:
        data["sort_order"] = _auto_sort_order(db, payload.parent_id)
    cat = Category(**data)
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists")
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
    data = payload.model_dump()
    parent_changed = data.get("parent_id") != cat.parent_id
    for key, val in data.items():
        if key == "sort_order" and val is None:
            continue
        setattr(cat, key, val)
    if parent_changed and data.get("sort_order") is None:
        cat.sort_order = _auto_sort_order(db, cat.parent_id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists")
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
