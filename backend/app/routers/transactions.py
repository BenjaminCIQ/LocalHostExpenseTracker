import math

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_classifier, get_name_suggester, get_pipeline
from app.ml.classifier import MLClassifier
from app.ml.name_suggester import CanonicalNameSuggester
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.trip import Trip, TripTransactionOverride
from app.pipeline.pipeline import ClassificationPipeline
from app.schemas.transaction import (
    BulkUpdateFieldsRequest,
    BulkUpdateFieldsResponse,
    BulkClassifyRequest,
    BulkClassifyResponse,
    SimilarTransactionCandidate,
    SuggestFieldUpdateCandidate,
    TransferAutoLinkResponse,
    TransferCandidate,
    TransferLinkRequest,
    TransferLinkResponse,
    TransferUnlinkRequest,
    TransactionManualCreate,
    TransactionClassify,
    TransactionListResponse,
    TransactionRawRead,
    TransactionRead,
    TransactionUpdate,
)
from app.services.similarity_service import (
    find_similar,
    find_similar_unclassified,
    learn_merchant_alias,
)
from app.services.classification_service import (
    classify_transaction_manual,
    run_pipeline_on_transaction,
    run_pipeline_on_unclassified,
)
from app.services.ingestion_service import compute_dedup_hash
from app.models.account import Account
from app.services.transfer_reconciliation_service import (
    auto_link_high_confidence,
    find_transfer_candidates,
    link_transfer_pair,
    unlink_transfer,
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
        transaction_kind=txn.transaction_kind or ("income" if txn.amount > 0 else ("expense" if txn.amount < 0 else "adjustment")),
        transfer_group_id=txn.transfer_group_id,
        transfer_linked_transaction_id=txn.transfer_linked_transaction_id,
        transfer_confidence=txn.transfer_confidence,
        transfer_match_source=txn.transfer_match_source,
        is_internal_transfer=txn.is_internal_transfer,
        created_at=txn.created_at,
    )


@router.get("/", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    account_id: int | None = None,
    person_id: int | None = None,
    classified: bool | None = None,
    q: str | None = Query(None, description="Free-text search (merchant/description/raw_description)"),
    merchant: str | None = Query(None, description="Merchant/store contains"),
    category_id: int | None = Query(None, description="Matches final or predicted category"),
    category_ids: str | None = Query(None, description="Comma separated category ids"),
    start_date: date | None = Query(None, description="YYYY-MM-DD inclusive"),
    end_date: date | None = Query(None, description="YYYY-MM-DD inclusive"),
    trip_id: int | None = Query(None, description="Trip id filter with include/exclude overrides"),
    min_amount: float | None = None,
    max_amount: float | None = None,
    transaction_kind: str | None = Query(None, pattern="^(income|expense|transfer|adjustment)$"),
    include_transfers: bool = True,
    sort_by: str = Query("date", pattern="^(date|amount|merchant|description|category)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if person_id is not None:
        query = query.join(Account, Transaction.account_id == Account.id).filter(
            Account.person_id == person_id
        )
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
    elif category_ids:
        ids: list[int] = []
        for raw in category_ids.split(","):
            val = raw.strip()
            if not val:
                continue
            try:
                ids.append(int(val))
            except ValueError:
                continue
        if ids:
            query = query.filter(
                or_(
                    Transaction.final_category_id.in_(ids),
                    Transaction.predicted_category_id.in_(ids),
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
    if trip_id is not None:
        trip = db.get(Trip, trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        include_override = (
            db.query(TripTransactionOverride.id)
            .filter(
                TripTransactionOverride.trip_id == trip_id,
                TripTransactionOverride.transaction_id == Transaction.id,
                TripTransactionOverride.include.is_(True),
            )
            .exists()
        )
        exclude_override = (
            db.query(TripTransactionOverride.id)
            .filter(
                TripTransactionOverride.trip_id == trip_id,
                TripTransactionOverride.transaction_id == Transaction.id,
                TripTransactionOverride.include.is_(False),
            )
            .exists()
        )
        auto_in_window = and_(
            Transaction.date >= trip.start_date,
            Transaction.date <= trip.end_date,
        )
        query = query.filter(
            or_(
                include_override,
                and_(auto_in_window, ~exclude_override),
            )
        )

    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if transaction_kind:
        query = query.filter(Transaction.transaction_kind == transaction_kind)
    if not include_transfers:
        query = query.filter(Transaction.is_internal_transfer.is_(False))

    total = query.count()
    sort_column = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "merchant": Transaction.merchant,
        "description": Transaction.description,
    }.get(sort_by, Transaction.date)

    if sort_by == "category":
        query = query.outerjoin(Category, Transaction.final_category_id == Category.id)
        sort_column = Category.name

    order_expr = sort_column.asc() if sort_dir == "asc" else sort_column.desc()
    items = (
        query.order_by(order_expr, Transaction.id.desc())
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


@router.get("/transfer-candidates", response_model=list[TransferCandidate])
def get_transfer_candidates(
    limit: int = Query(100, ge=1, le=500),
    account_id: int | None = None,
    person_id: int | None = None,
    db: Session = Depends(get_db),
):
    person_account_ids: list[int] | None = None
    if person_id is not None:
        person_account_ids = [
            a.id
            for a in db.query(Account).filter(Account.person_id == person_id).all()
        ]
    candidates = find_transfer_candidates(
        db, limit=limit, account_id=account_id, person_account_ids=person_account_ids
    )
    return [
        TransferCandidate(
            transaction_id=item.transaction_id,
            candidate_id=item.candidate_id,
            transaction_date=item.transaction_date,
            candidate_date=item.candidate_date,
            transaction_amount=item.transaction_amount,
            candidate_amount=item.candidate_amount,
            transaction_account_id=item.transaction_account_id,
            candidate_account_id=item.candidate_account_id,
            transaction_currency=item.transaction_currency,
            candidate_currency=item.candidate_currency,
            score=item.score,
            reason=item.reason,
        )
        for item in candidates
    ]


@router.post("/transfers/auto-link", response_model=TransferAutoLinkResponse)
def auto_link_transfers(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    linked, reviewed, skipped = auto_link_high_confidence(db, limit=limit)
    return TransferAutoLinkResponse(linked=linked, reviewed=reviewed, skipped=skipped)


@router.post("/transfers/link", response_model=TransferLinkResponse)
def link_transfer(
    payload: TransferLinkRequest,
    db: Session = Depends(get_db),
):
    try:
        group_id = link_transfer_pair(
            db,
            transaction_id=payload.transaction_id,
            candidate_id=payload.candidate_id,
            confidence=payload.confidence,
            source="manual",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return TransferLinkResponse(linked=True, transfer_group_id=group_id)


@router.post("/transfers/unlink", response_model=TransferLinkResponse)
def unlink_transfer_endpoint(
    payload: TransferUnlinkRequest,
    db: Session = Depends(get_db),
):
    try:
        unlinked = unlink_transfer(db, payload.transaction_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return TransferLinkResponse(linked=unlinked, transfer_group_id=None)


@router.get("/bounds")
def get_transaction_bounds(
    account_id: int | None = None,
    person_id: int | None = None,
    classified: bool | None = None,
    db: Session = Depends(get_db),
):
    """Return min/max date and min/max amount for current dataset (for UI filters)."""
    query = db.query(Transaction)
    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if person_id is not None:
        query = query.join(Account, Transaction.account_id == Account.id).filter(
            Account.person_id == person_id
        )
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


@router.get("/merchant-suggestions", response_model=list[str])
def get_merchant_suggestions(
    q: str = Query("", description="Prefix query for merchant name suggestions"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query_text = (q or "").strip()
    if not query_text:
        return []
    like = f"{query_text.lower()}%"
    rows = (
        db.query(Transaction.merchant, func.count(Transaction.id).label("freq"))
        .filter(
            Transaction.merchant.isnot(None),
            Transaction.merchant != "",
            func.lower(Transaction.merchant).like(like),
        )
        .group_by(Transaction.merchant)
        .order_by(func.count(Transaction.id).desc(), Transaction.merchant.asc())
        .limit(limit)
        .all()
    )
    return [merchant for merchant, _freq in rows if merchant]

@router.get("/{transaction_id}/similar", response_model=list[SimilarTransactionCandidate])
def get_similar_transactions(
    transaction_id: int,
    limit: int = Query(25, ge=1, le=200),
    min_score: int = Query(80, ge=0, le=100),
    db: Session = Depends(get_db),
):
    try:
        results = find_similar_unclassified(
            db, transaction_id, limit=limit, min_score=min_score
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return [
        SimilarTransactionCandidate(
            transaction_id=r.transaction_id,
            date=r.date,
            amount=r.amount,
            merchant=r.merchant,
            description=r.description,
            score=r.score,
            reason=r.reason,
            predicted_category_id=r.predicted_category_id,
            final_category_id=r.final_category_id,
        )
        for r in results
    ]

@router.get("/{transaction_id}/raw", response_model=TransactionRawRead)
def get_transaction_raw(transaction_id: int, db: Session = Depends(get_db)):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionRawRead(raw_row_json=txn.raw_row_json, raw_row_line=txn.raw_row_line)

@router.get(
    "/{transaction_id}/suggest-field-updates",
    response_model=list[SuggestFieldUpdateCandidate],
)
def suggest_field_updates(
    transaction_id: int,
    limit: int = Query(25, ge=1, le=200),
    min_score: int = Query(85, ge=0, le=100),
    only_unclassified: bool = Query(True),
    exclude_already_matching: bool = Query(False),
    db: Session = Depends(get_db),
    name_suggester: CanonicalNameSuggester = Depends(get_name_suggester),
):
    seed = db.get(Transaction, transaction_id)
    if not seed:
        raise HTTPException(status_code=404, detail="Transaction not found")

    similar = find_similar(
        db,
        transaction_id,
        limit=limit,
        min_score=min_score,
        only_unclassified=only_unclassified,
    )
    similar_by_id = {item.transaction_id: item for item in similar}
    txns = [db.get(Transaction, s.transaction_id) for s in similar]
    txns = [t for t in txns if t is not None]
    response: list[SuggestFieldUpdateCandidate] = []
    for t in txns:
        sim = similar_by_id.get(t.id)
        if sim is None:
            continue
        if exclude_already_matching:
            # Strict case-sensitive equality to avoid showing one-to-one exact matches.
            same_merchant = (t.merchant or "") == (seed.merchant or "")
            same_description = (t.description or "") == (seed.description or "")
            same_raw = (t.raw_description or "") == (seed.raw_description or "")
            if same_merchant or same_description or same_raw:
                continue
        ml_hint = name_suggester.suggest(
            t.raw_description or t.description or "",
            t.merchant or "",
        )
        response.append(
            SuggestFieldUpdateCandidate(
                transaction_id=t.id,
                score=float(sim.score),
                reason=str(sim.reason),
                reasons=list(sim.reasons),
                matched_fields=list(sim.matched_fields),
                score_components=dict(sim.score_components),
                is_classified=bool(sim.is_classified),
                current_merchant=t.merchant,
                current_description=t.description,
                current_raw_description=t.raw_description,
                suggested_merchant=seed.merchant or None,
                suggested_description=seed.description or None,
                suggested_raw_description=seed.raw_description or None,
                ml_suggested_merchant=(
                    str(ml_hint.get("suggested_merchant"))
                    if ml_hint.get("suggested_merchant") is not None
                    else None
                ),
                ml_merchant_confidence=float(ml_hint.get("merchant_confidence") or 0.0),
                ml_suggested_description=(
                    str(ml_hint.get("suggested_description"))
                    if ml_hint.get("suggested_description") is not None
                    else None
                ),
                ml_description_confidence=float(
                    ml_hint.get("description_confidence") or 0.0
                ),
            )
        )
    return response


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

@router.post("/bulk-classify", response_model=BulkClassifyResponse)
def bulk_classify(
    payload: BulkClassifyRequest,
    db: Session = Depends(get_db),
    classifier: MLClassifier = Depends(get_classifier),
):
    if not payload.transaction_ids:
        return BulkClassifyResponse(updated=0, skipped=0)

    updated = 0
    skipped = 0
    for txn_id in payload.transaction_ids:
        txn = db.get(Transaction, txn_id)
        if not txn:
            skipped += 1
            continue
        # Guardrail: don't mutate already-classified transactions in bulk.
        if txn.final_category_id is not None:
            skipped += 1
            continue
        classify_transaction_manual(
            db, txn, payload.category_id, payload.merchant, classifier
        )
        updated += 1

    return BulkClassifyResponse(updated=updated, skipped=skipped)

@router.post("/manual", response_model=TransactionRead, status_code=201)
def create_manual_transaction(
    payload: TransactionManualCreate,
    db: Session = Depends(get_db),
    pipeline: ClassificationPipeline = Depends(get_pipeline),
):
    acc = db.get(Account, payload.account_id)
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    raw_desc = payload.raw_description or payload.description
    dedup = compute_dedup_hash(payload.account_id, str(payload.date), payload.amount, raw_desc)
    exists = db.query(Transaction.id).filter(Transaction.dedup_hash == dedup).first()
    if exists:
        raise HTTPException(status_code=409, detail="Duplicate transaction (same dedup hash)")

    txn = Transaction(
        account_id=payload.account_id,
        import_batch_id=None,
        date=payload.date,
        amount=payload.amount,
        raw_description=raw_desc,
        description=payload.description,
        merchant=payload.merchant or "",
        currency=payload.currency,
        dedup_hash=dedup,
        raw_row_json=None,
        raw_row_line=None,
        transaction_kind="income" if payload.amount > 0 else ("expense" if payload.amount < 0 else "adjustment"),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    # Populate prediction immediately for convenience (does not set final_category).
    txn = run_pipeline_on_transaction(db, txn, pipeline)
    return _to_read(txn, db)

@router.post("/bulk-update-fields", response_model=BulkUpdateFieldsResponse)
def bulk_update_fields(
    payload: BulkUpdateFieldsRequest,
    db: Session = Depends(get_db),
    pipeline: ClassificationPipeline = Depends(get_pipeline),
    name_suggester: CanonicalNameSuggester = Depends(get_name_suggester),
):
    if not payload.transaction_ids:
        return BulkUpdateFieldsResponse(updated=0, skipped=0, skipped_reasons={})
    if (
        payload.merchant is None
        and payload.description is None
        and payload.raw_description is None
    ):
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = 0
    updated_classified = 0
    skipped = 0
    skipped_reasons: dict[str, int] = {}
    for txn_id in payload.transaction_ids:
        txn = db.get(Transaction, txn_id)
        if not txn:
            skipped += 1
            skipped_reasons["not_found"] = skipped_reasons.get("not_found", 0) + 1
            continue
        if txn.final_category_id is not None and not payload.allow_classified:
            skipped += 1
            skipped_reasons["classified_locked"] = (
                skipped_reasons.get("classified_locked", 0) + 1
            )
            continue

        old_merchant = txn.merchant
        old_description = txn.description
        old_raw_description = txn.raw_description
        if payload.merchant is not None:
            txn.merchant = payload.merchant
        if payload.description is not None:
            txn.description = payload.description
        if payload.raw_description is not None:
            txn.raw_description = payload.raw_description
        if payload.allow_classified and txn.final_category_id is not None:
            updated_classified += 1
        if payload.merchant is not None and old_merchant and txn.merchant:
            learn_merchant_alias(db, old_merchant, txn.merchant)
        if payload.merchant is not None or payload.description is not None:
            name_suggester.record_example(
                db,
                input_description=old_raw_description or old_description or "",
                input_merchant=old_merchant or "",
                target_merchant=txn.merchant or "",
                target_description=txn.description or "",
            )
        db.add(txn)
        updated += 1

    db.commit()
    name_suggester.retrain(db)

    if payload.re_predict:
        for txn_id in payload.transaction_ids:
            txn = db.get(Transaction, txn_id)
            if txn and txn.final_category_id is None:
                run_pipeline_on_transaction(db, txn, pipeline)

    return BulkUpdateFieldsResponse(
        updated=updated,
        skipped=skipped,
        skipped_reasons=skipped_reasons,
        updated_classified=updated_classified,
    )


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    pipeline: ClassificationPipeline = Depends(get_pipeline),
    name_suggester: CanonicalNameSuggester = Depends(get_name_suggester),
):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    old_merchant = txn.merchant
    old_description = txn.description
    old_raw_description = txn.raw_description
    if payload.merchant is not None:
        txn.merchant = payload.merchant
    if payload.description is not None:
        txn.description = payload.description
    if payload.raw_description is not None:
        txn.raw_description = payload.raw_description
    if payload.date is not None:
        txn.date = payload.date
    if payload.amount is not None:
        txn.amount = payload.amount
        if payload.transaction_kind is None and not txn.is_internal_transfer:
            txn.transaction_kind = "income" if txn.amount > 0 else ("expense" if txn.amount < 0 else "adjustment")
    if payload.currency is not None:
        txn.currency = payload.currency
    if payload.transaction_kind is not None:
        txn.transaction_kind = payload.transaction_kind
    if payload.transfer_group_id is not None:
        txn.transfer_group_id = payload.transfer_group_id
    if payload.transfer_linked_transaction_id is not None:
        txn.transfer_linked_transaction_id = payload.transfer_linked_transaction_id
    if payload.transfer_confidence is not None:
        txn.transfer_confidence = payload.transfer_confidence
    if payload.transfer_match_source is not None:
        txn.transfer_match_source = payload.transfer_match_source
    if payload.is_internal_transfer is not None:
        txn.is_internal_transfer = payload.is_internal_transfer
    if payload.merchant is not None and old_merchant and txn.merchant:
        learn_merchant_alias(db, old_merchant, txn.merchant)
    if payload.merchant is not None or payload.description is not None:
        name_suggester.record_example(
            db,
            input_description=old_raw_description or old_description or "",
            input_merchant=old_merchant or "",
            target_merchant=txn.merchant or "",
            target_description=txn.description or "",
        )
    db.commit()
    if payload.merchant is not None or payload.description is not None:
        name_suggester.retrain(db)
    db.refresh(txn)

    if txn.final_category_id is None:
        txn = run_pipeline_on_transaction(db, txn, pipeline)
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
