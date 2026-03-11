import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db

logger = logging.getLogger(__name__)
from app.models.budget import Budget
from app.models.category import Category
from app.models.classification_log import ClassificationLog
from app.models.merchant_memory import MerchantCategoryStats
from app.models.rule import Rule
from app.models.training_data import TrainingData
from app.models.transaction import Transaction
from app.models.trip import Trip
from app.models.user_override import UserOverride
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
    is_income_changed = "is_income" in data and data["is_income"] != cat.is_income
    for key, val in data.items():
        if key == "sort_order" and val is None:
            continue
        setattr(cat, key, val)
    if parent_changed and data.get("sort_order") is None:
        cat.sort_order = _auto_sort_order(db, cat.parent_id)
    try:
        db.commit()
        # When is_income changes, sync transaction_kind for all transactions
        # in this category so filtering stays consistent.
        if is_income_changed:
            expected_kind = "income" if cat.is_income else "expense"
            db.query(Transaction).filter(
                Transaction.final_category_id == category_id,
                Transaction.is_internal_transfer.is_(False),
            ).update({Transaction.transaction_kind: expected_kind}, synchronize_session=False)
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

    # Check for blocking references before delete
    child_ids = [r[0] for r in db.query(Category.id).filter(Category.parent_id == category_id).all()]
    if child_ids:
        msg = f"DELETE category {category_id} ({cat.name}): blocked - has subcategories"
        logger.warning(msg)
        print(msg, flush=True)
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot delete: category has subcategories. Delete or move them first.",
                "debug": {"blocked_by": "subcategories", "child_category_ids": child_ids},
            },
        )

    # Block only if transactions have this as final (user-confirmed) category.
    final_txn_ids = [
        r[0]
        for r in db.query(Transaction.id).filter(Transaction.final_category_id == category_id).all()
    ]
    if final_txn_ids:
        msg = f"DELETE category {category_id} ({cat.name}): blocked - used as final category by {len(final_txn_ids)} transaction(s)"
        logger.warning(msg)
        print(msg, flush=True)
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot delete: category is used by transactions. Reassign or remove those first.",
                "debug": {
                    "blocked_by": "transactions",
                    "transaction_ids": final_txn_ids[:100],  # Cap for large lists
                    "total_count": len(final_txn_ids),
                },
            },
        )

    # Clear predicted_category_id for any transactions that had this as ML suggestion
    db.query(Transaction).filter(Transaction.predicted_category_id == category_id).update(
        {Transaction.predicted_category_id: None, Transaction.confidence: None},
        synchronize_session=False,
    )

    # Clear or remove all other references before delete to avoid IntegrityError
    db.query(Budget).filter(Budget.category_id == category_id).update(
        {Budget.category_id: None}, synchronize_session=False
    )
    db.query(Trip).filter(Trip.default_category_id == category_id).update(
        {Trip.default_category_id: None}, synchronize_session=False
    )
    db.query(ClassificationLog).filter(
        (ClassificationLog.predicted_category_id == category_id)
        | (ClassificationLog.final_category_id == category_id)
    ).update(
        {
            ClassificationLog.predicted_category_id: None,
            ClassificationLog.final_category_id: None,
        },
        synchronize_session=False,
    )
    db.query(MerchantCategoryStats).filter(
        MerchantCategoryStats.category_id == category_id
    ).delete(synchronize_session=False)
    db.query(TrainingData).filter(TrainingData.category_id == category_id).delete(
        synchronize_session=False
    )

    # Rule and UserOverride require category_id - block if referenced
    rule_ids = [r[0] for r in db.query(Rule.id).filter(Rule.category_id == category_id).all()]
    override_ids = [
        r[0]
        for r in db.query(UserOverride.id).filter(UserOverride.category_id == category_id).all()
    ]
    if rule_ids or override_ids:
        blockers = []
        if rule_ids:
            blockers.append(f"parsing rules (ids: {rule_ids[:20]}{'...' if len(rule_ids) > 20 else ''})")
        if override_ids:
            blockers.append(
                f"user overrides (ids: {override_ids[:20]}{'...' if len(override_ids) > 20 else ''})"
            )
        msg = f"DELETE category {category_id} ({cat.name}): blocked - used by {', '.join(blockers)}"
        logger.warning(msg)
        print(msg, flush=True)
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot delete: category is used by parsing rules or user overrides. Remove those first.",
                "debug": {
                    "blocked_by": "rules_or_overrides",
                    "rule_ids": rule_ids,
                    "user_override_ids": override_ids,
                },
            },
        )

    try:
        db.delete(cat)
        db.commit()
        logger.info("Deleted category %s (%s)", category_id, cat.name)
    except IntegrityError as e:
        db.rollback()
        msg = f"DELETE category {category_id} ({cat.name}): IntegrityError - {e!s}"
        logger.warning(msg)
        print(msg, flush=True)
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot delete: category is referenced elsewhere (budgets, rules, trips, etc.).",
                "debug": {"blocked_by": "integrity_error", "raw_error": str(e)},
            },
        )
