import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, false, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.trip import Trip, TripMembershipSuggestion, TripTransactionOverride
from app.schemas.trip import (
    TripCreate,
    TripOverrideUpsert,
    TripSuggestionApplyRequest,
    TripSuggestionApplyResponse,
    TripSuggestionRecomputeResponse,
    TripSuggestionResetRequest,
    TripSuggestionResetResponse,
    TripMembershipSuggestionRead,
    TripRead,
    TripTransactionItem,
    TripTransactionsResponse,
    TripUpdate,
)
from app.services.trip_suggestion_service import recompute_trip_suggestions

router = APIRouter(prefix="/api/trips", tags=["trips"])


def _trip_to_read(db: Session, trip: Trip) -> TripRead:
    overrides_count = (
        db.query(TripTransactionOverride.id)
        .filter(TripTransactionOverride.trip_id == trip.id)
        .count()
    )
    return TripRead(
        id=trip.id,
        name=trip.name,
        start_date=trip.start_date,
        end_date=trip.end_date,
        destination=trip.destination,
        notes=trip.notes,
        default_category_id=trip.default_category_id,
        created_at=trip.created_at,
        overrides_count=overrides_count,
    )


def _txn_to_trip_item(
    db: Session,
    txn: Transaction,
    membership: str,
    membership_source: str,
    suggestion: TripMembershipSuggestion | None,
) -> TripTransactionItem:
    pred_name = None
    final_name = None
    if txn.predicted_category_id:
        cat = db.get(Category, txn.predicted_category_id)
        pred_name = cat.name if cat else None
    if txn.final_category_id:
        cat = db.get(Category, txn.final_category_id)
        final_name = cat.name if cat else None
    return TripTransactionItem(
        id=txn.id,
        date=txn.date,
        amount=txn.amount,
        merchant=txn.merchant,
        description=txn.description,
        raw_description=txn.raw_description,
        currency=txn.currency,
        final_category_id=txn.final_category_id,
        final_category_name=final_name,
        predicted_category_id=txn.predicted_category_id,
        predicted_category_name=pred_name,
        membership=membership,
        membership_source=membership_source,
        suggested_membership=suggestion.suggested_membership if suggestion else None,
        suggestion_score=suggestion.score if suggestion else None,
        suggestion_reasons=(
            json.loads(suggestion.reasons_json)
            if suggestion and suggestion.reasons_json
            else []
        ),
    )


@router.get("/", response_model=list[TripRead])
def list_trips(db: Session = Depends(get_db)):
    trips = db.query(Trip).order_by(Trip.start_date.desc(), Trip.id.desc()).all()
    return [_trip_to_read(db, t) for t in trips]


@router.post("/", response_model=TripRead, status_code=201)
def create_trip(payload: TripCreate, db: Session = Depends(get_db)):
    if payload.default_category_id is not None and not db.get(Category, payload.default_category_id):
        raise HTTPException(status_code=404, detail="Default category not found")
    trip = Trip(**payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return _trip_to_read(db, trip)


@router.patch("/{trip_id}", response_model=TripRead)
def update_trip(trip_id: int, payload: TripUpdate, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    data = payload.model_dump(exclude_unset=True)
    if "default_category_id" in data and data["default_category_id"] is not None:
        if not db.get(Category, data["default_category_id"]):
            raise HTTPException(status_code=404, detail="Default category not found")
    next_start = data.get("start_date", trip.start_date)
    next_end = data.get("end_date", trip.end_date)
    if next_end < next_start:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    for key, value in data.items():
        setattr(trip, key, value)
    db.commit()
    db.refresh(trip)
    return _trip_to_read(db, trip)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()


@router.get("/{trip_id}/transactions", response_model=TripTransactionsResponse)
def list_trip_transactions(
    trip_id: int,
    q: str | None = Query(None, description="Optional free-text search"),
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    overrides = (
        db.query(TripTransactionOverride)
        .filter(TripTransactionOverride.trip_id == trip_id)
        .all()
    )
    override_by_txn_id = {o.transaction_id: o.include for o in overrides}
    suggestions = (
        db.query(TripMembershipSuggestion)
        .filter(TripMembershipSuggestion.trip_id == trip_id)
        .all()
    )
    suggestion_by_txn_id = {s.transaction_id: s for s in suggestions}
    override_txn_ids = list(override_by_txn_id.keys())

    query = db.query(Transaction).filter(
        or_(
            and_(Transaction.date >= trip.start_date, Transaction.date <= trip.end_date),
            Transaction.id.in_(override_txn_ids) if override_txn_ids else false(),
        )
    )

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                Transaction.merchant.ilike(like),
                Transaction.description.ilike(like),
                Transaction.raw_description.ilike(like),
                func.coalesce(Transaction.raw_row_line, "").ilike(like),
            )
        )

    items = query.order_by(Transaction.date.desc(), Transaction.id.desc()).all()

    mapped: list[TripTransactionItem] = []
    for txn in items:
        suggestion = suggestion_by_txn_id.get(txn.id)
        if txn.id in override_by_txn_id:
            membership = "include" if override_by_txn_id[txn.id] else "exclude"
            source = "manual_override"
        elif suggestion and suggestion.is_applied and suggestion.suggested_membership in ("include", "exclude"):
            membership = suggestion.suggested_membership
            source = "suggestion_applied"
        else:
            in_window = trip.start_date <= txn.date <= trip.end_date
            membership = "include" if in_window else "exclude"
            source = "auto"
        mapped.append(_txn_to_trip_item(db, txn, membership, source, suggestion))
    return TripTransactionsResponse(items=mapped, total=len(mapped))


@router.put("/{trip_id}/overrides", response_model=TripRead)
def upsert_override(
    trip_id: int,
    payload: TripOverrideUpsert,
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    txn = db.get(Transaction, payload.transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    override = (
        db.query(TripTransactionOverride)
        .filter(
            TripTransactionOverride.trip_id == trip_id,
            TripTransactionOverride.transaction_id == payload.transaction_id,
        )
        .first()
    )
    if override:
        override.include = payload.include
    else:
        db.add(
            TripTransactionOverride(
                trip_id=trip_id,
                transaction_id=payload.transaction_id,
                include=payload.include,
            )
        )
    db.commit()
    db.refresh(trip)
    return _trip_to_read(db, trip)


@router.delete("/{trip_id}/overrides/{transaction_id}", response_model=TripRead)
def delete_override(
    trip_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    override = (
        db.query(TripTransactionOverride)
        .filter(
            TripTransactionOverride.trip_id == trip_id,
            TripTransactionOverride.transaction_id == transaction_id,
        )
        .first()
    )
    if override:
        db.delete(override)
        db.commit()
        db.refresh(trip)
    return _trip_to_read(db, trip)


@router.post("/{trip_id}/suggestions/recompute", response_model=TripSuggestionRecomputeResponse)
def recompute_suggestions(
    trip_id: int,
    force: bool = Query(False, description="Recompute applied suggestions too"),
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    updated, skipped_manual = recompute_trip_suggestions(db, trip, force=force)
    return TripSuggestionRecomputeResponse(
        created_or_updated=updated,
        skipped_manual_overrides=skipped_manual,
    )


@router.get("/{trip_id}/suggestions", response_model=list[TripMembershipSuggestionRead])
def list_suggestions(
    trip_id: int,
    bucket: str | None = Query(None, description="include|exclude|review"),
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    query = db.query(TripMembershipSuggestion).filter(TripMembershipSuggestion.trip_id == trip_id)
    if bucket in ("include", "exclude", "review"):
        query = query.filter(TripMembershipSuggestion.suggested_membership == bucket)
    rows = query.order_by(TripMembershipSuggestion.score.desc(), TripMembershipSuggestion.id.desc()).all()
    return [
        TripMembershipSuggestionRead(
            transaction_id=row.transaction_id,
            suggested_membership=row.suggested_membership,
            score=row.score,
            reasons=json.loads(row.reasons_json) if row.reasons_json else [],
            is_applied=row.is_applied,
        )
        for row in rows
    ]


@router.post("/{trip_id}/suggestions/apply", response_model=TripSuggestionApplyResponse)
def apply_suggestions(
    trip_id: int,
    payload: TripSuggestionApplyRequest,
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    query = db.query(TripMembershipSuggestion).filter(TripMembershipSuggestion.trip_id == trip_id)
    if payload.apply_bucket and payload.bucket in ("include", "exclude", "review"):
        query = query.filter(TripMembershipSuggestion.suggested_membership == payload.bucket)
    elif payload.transaction_ids:
        query = query.filter(TripMembershipSuggestion.transaction_id.in_(payload.transaction_ids))
    else:
        raise HTTPException(status_code=400, detail="Provide transaction_ids or set apply_bucket=true with a bucket")

    suggestions = query.all()
    manual_override_txn_ids = {
        row[0]
        for row in db.query(TripTransactionOverride.transaction_id)
        .filter(TripTransactionOverride.trip_id == trip_id)
        .all()
    }

    applied = 0
    skipped = 0
    for suggestion in suggestions:
        if suggestion.transaction_id in manual_override_txn_ids:
            skipped += 1
            continue

        if suggestion.suggested_membership == "review":
            if payload.include_review_as not in ("include", "exclude"):
                skipped += 1
                continue
            suggestion.suggested_membership = payload.include_review_as

        suggestion.is_applied = True
        applied += 1

    db.commit()
    return TripSuggestionApplyResponse(applied=applied, skipped=skipped)


@router.post("/{trip_id}/suggestions/reset", response_model=TripSuggestionResetResponse)
def reset_suggestions(
    trip_id: int,
    payload: TripSuggestionResetRequest,
    db: Session = Depends(get_db),
):
    trip = db.get(Trip, trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    query = db.query(TripMembershipSuggestion).filter(TripMembershipSuggestion.trip_id == trip_id)
    if payload.only_unapplied:
        query = query.filter(TripMembershipSuggestion.is_applied.is_(False))
    rows = query.all()
    removed = len(rows)
    for row in rows:
        db.delete(row)
    db.commit()
    return TripSuggestionResetResponse(removed=removed)

