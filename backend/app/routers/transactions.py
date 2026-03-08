import math

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_classifier, get_pipeline
from app.ml.classifier import MLClassifier
from app.models.category import Category
from app.models.transaction import Transaction
from app.pipeline.pipeline import ClassificationPipeline
from app.schemas.transaction import (
    TransactionClassify,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdate,
)
from app.services.classification_service import (
    classify_transaction_manual,
    run_pipeline_on_transaction,
    run_pipeline_on_unclassified,
)

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _to_read(txn: Transaction, db: Session) -> TransactionRead:
    pred_name = None
    final_name = None
    if txn.predicted_category_id:
        cat = db.get(Category, txn.predicted_category_id)
        pred_name = cat.name if cat else None
    if txn.final_category_id:
        cat = db.get(Category, txn.final_category_id)
        final_name = cat.name if cat else None
    return TransactionRead(
        id=txn.id,
        account_id=txn.account_id,
        date=txn.date,
        amount=txn.amount,
        raw_description=txn.raw_description,
        description=txn.description,
        merchant=txn.merchant,
        currency=txn.currency,
        predicted_category_id=txn.predicted_category_id,
        predicted_category_name=pred_name,
        final_category_id=txn.final_category_id,
        final_category_name=final_name,
        classification_source=txn.classification_source,
        confidence=txn.confidence,
        created_at=txn.created_at,
    )


@router.get("/", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    account_id: int | None = None,
    classified: bool | None = None,
    q: str | None = Query(None, description="Free-text search (merchant/description/raw_description)"),
    merchant: str | None = Query(None, description="Merchant/store contains"),
    category_id: int | None = Query(None, description="Matches final or predicted category"),
    start_date: date | None = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: date | None = Query(None, description="YYYY-MM-DD inclusive"),
    min_amount: float | None = None,
    max_amount: float | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if classified is True:
        query = query.filter(Transaction.final_category_id.isnot(None))
    elif classified is False:
        query = query.filter(Transaction.final_category_id.is_(None))

    if category_id is not None:
        query = query.filter(
            or_(
                Transaction.final_category_id == category_id,
                Transaction.predicted_category_id == category_id,
            )
        )

    def _contains(col, text: str):
        like = f"%{text.lower()}%"
        return func.lower(col).like(like)

    if merchant:
        query = query.filter(_contains(Transaction.merchant, merchant))

    if q:
        query = query.filter(
            or_(
                _contains(Transaction.merchant, q),
                _contains(Transaction.description, q),
                _contains(Transaction.raw_description, q),
            )
        )

    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)

    total = query.count()
    items = (
        query.order_by(Transaction.date.desc(), Transaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return TransactionListResponse(
        items=[_to_read(t, db) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/bounds")
def get_transaction_bounds(
    account_id: int | None = None,
    classified: bool | None = None,
    db: Session = Depends(get_db),
):
    """Return min/max date and min/max amount for current dataset (for UI filters)."""
    query = db.query(Transaction)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if classified is True:
        query = query.filter(Transaction.final_category_id.isnot(None))
    elif classified is False:
        query = query.filter(Transaction.final_category_id.is_(None))

    min_date, max_date, min_amount, max_amount = query.with_entities(
        func.min(Transaction.date),
        func.max(Transaction.date),
        func.min(Transaction.amount),
        func.max(Transaction.amount),
    ).first()

    return {
        "min_date": str(min_date) if min_date else None,
        "max_date": str(max_date) if max_date else None,
        "min_amount": float(min_amount) if min_amount is not None else None,
        "max_amount": float(max_amount) if max_amount is not None else None,
    }


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _to_read(txn, db)


@router.post("/{transaction_id}/classify", response_model=TransactionRead)
def classify_transaction(
    transaction_id: int,
    payload: TransactionClassify,
    db: Session = Depends(get_db),
    classifier: MLClassifier = Depends(get_classifier),
):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    cat = db.get(Category, payload.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    txn = classify_transaction_manual(
        db, txn, payload.category_id, payload.merchant, classifier
    )
    return _to_read(txn, db)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if payload.merchant is not None:
        txn.merchant = payload.merchant
    if payload.description is not None:
        txn.description = payload.description
    db.commit()
    db.refresh(txn)
    return _to_read(txn, db)


@router.post("/classify-all")
def classify_all_unclassified(
    db: Session = Depends(get_db),
    pipeline: ClassificationPipeline = Depends(get_pipeline),
):
    count = run_pipeline_on_unclassified(db, pipeline)
    return {"processed": count}


@router.post("/{transaction_id}/predict", response_model=TransactionRead)
def predict_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    pipeline: ClassificationPipeline = Depends(get_pipeline),
):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn = run_pipeline_on_transaction(db, txn, pipeline)
    return _to_read(txn, db)
