from datetime import date
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.external_account import (
    ExternalAccount,
    ExternalFundingLink,
    ExternalValuationSnapshot,
)
from app.models.person import Person
from app.models.transaction import Transaction
from app.schemas.external_account import (
    ExternalAccountCreate,
    ExternalAccountRead,
    ExternalAccountUpdate,
    ExternalFundingLinkCreate,
    ExternalFundingLinkRead,
    ExternalFundingSummaryRead,
    ExternalReconciliationRead,
    ExternalValuationSnapshotCreate,
    ExternalValuationSnapshotRead,
)
from app.services.external_account_service import get_external_reconciliation

router = APIRouter(prefix="/api/external-accounts", tags=["external-accounts"])


@router.get("/", response_model=list[ExternalAccountRead])
def list_external_accounts(
    person_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(ExternalAccount)
    if person_id is not None:
        person = db.get(Person, person_id)
        if person and person.name:
            owner_match = func.lower(func.trim(func.coalesce(ExternalAccount.owner, ""))) == func.lower(
                func.trim(person.name)
            )
            q = q.filter(or_(ExternalAccount.person_id == person_id, owner_match))
        else:
            q = q.filter(ExternalAccount.person_id == person_id)
    return q.order_by(ExternalAccount.name.asc()).all()


@router.post("/", response_model=ExternalAccountRead, status_code=201)
def create_external_account(
    payload: ExternalAccountCreate,
    db: Session = Depends(get_db),
):
    if payload.person_id is not None and db.get(Person, payload.person_id) is None:
        raise HTTPException(status_code=404, detail="Person not found")
    item = ExternalAccount(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{external_account_id}", response_model=ExternalAccountRead)
def update_external_account(
    external_account_id: int,
    payload: ExternalAccountUpdate,
    db: Session = Depends(get_db),
):
    item = db.get(ExternalAccount, external_account_id)
    if not item:
        raise HTTPException(status_code=404, detail="External account not found")
    data = payload.model_dump(exclude_unset=True)
    if "person_id" in data and data["person_id"] is not None:
        if db.get(Person, data["person_id"]) is None:
            raise HTTPException(status_code=404, detail="Person not found")
    for k, v in data.items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{external_account_id}/snapshots", response_model=list[ExternalValuationSnapshotRead])
def list_snapshots(
    external_account_id: int,
    db: Session = Depends(get_db),
):
    if db.get(ExternalAccount, external_account_id) is None:
        raise HTTPException(status_code=404, detail="External account not found")
    return (
        db.query(ExternalValuationSnapshot)
        .filter(ExternalValuationSnapshot.external_account_id == external_account_id)
        .order_by(ExternalValuationSnapshot.snapshot_date.desc())
        .all()
    )


@router.post("/{external_account_id}/snapshots", response_model=ExternalValuationSnapshotRead, status_code=201)
def create_snapshot(
    external_account_id: int,
    payload: ExternalValuationSnapshotCreate,
    db: Session = Depends(get_db),
):
    if db.get(ExternalAccount, external_account_id) is None:
        raise HTTPException(status_code=404, detail="External account not found")
    item = ExternalValuationSnapshot(
        external_account_id=external_account_id,
        **payload.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{external_account_id}/funding-links", response_model=list[ExternalFundingLinkRead])
def list_funding_links(
    external_account_id: int,
    db: Session = Depends(get_db),
):
    if db.get(ExternalAccount, external_account_id) is None:
        raise HTTPException(status_code=404, detail="External account not found")
    return (
        db.query(ExternalFundingLink)
        .filter(ExternalFundingLink.external_account_id == external_account_id)
        .order_by(ExternalFundingLink.created_at.desc())
        .all()
    )


@router.post("/{external_account_id}/funding-links", response_model=ExternalFundingLinkRead, status_code=201)
def create_funding_link(
    external_account_id: int,
    payload: ExternalFundingLinkCreate,
    db: Session = Depends(get_db),
):
    if db.get(ExternalAccount, external_account_id) is None:
        raise HTTPException(status_code=404, detail="External account not found")
    txn = db.get(Transaction, payload.transaction_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.amount == 0 and not payload.override_validation:
        raise HTTPException(
            status_code=400,
            detail="Transaction has zero amount. Use override_validation to force link.",
        )

    if not payload.override_validation:
        if payload.link_type == "funding_in" and txn.amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="funding_in expects an inflow (positive amount). Use override_validation to force link.",
            )
        if payload.link_type == "funding_out" and txn.amount >= 0:
            raise HTTPException(
                status_code=400,
                detail="funding_out expects an outflow (negative amount). Use override_validation to force link.",
            )

    existing_total = (
        db.query(func.coalesce(func.sum(ExternalFundingLink.linked_amount), 0.0))
        .filter(ExternalFundingLink.transaction_id == txn.id)
        .scalar()
    )
    if (
        (float(existing_total or 0.0) + float(payload.linked_amount))
        > abs(float(txn.amount))
        and not payload.override_validation
    ):
        raise HTTPException(
            status_code=400,
            detail="Linked amount exceeds transaction amount.",
        )

    item = ExternalFundingLink(
        external_account_id=external_account_id,
        transaction_id=payload.transaction_id,
        linked_amount=payload.linked_amount,
        link_type=payload.link_type,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{external_account_id}/funding-links/{link_id}", status_code=204)
def delete_funding_link(
    external_account_id: int,
    link_id: int,
    db: Session = Depends(get_db),
):
    item = db.get(ExternalFundingLink, link_id)
    if item is None or item.external_account_id != external_account_id:
        raise HTTPException(status_code=404, detail="Funding link not found")
    db.delete(item)
    db.commit()
    return None


@router.get("/{external_account_id}/reconciliation", response_model=ExternalReconciliationRead)
def get_reconciliation(
    external_account_id: int,
    db: Session = Depends(get_db),
):
    if db.get(ExternalAccount, external_account_id) is None:
        raise HTTPException(status_code=404, detail="External account not found")
    return get_external_reconciliation(db, external_account_id)


@router.get("/funding-summary", response_model=ExternalFundingSummaryRead)
def get_funding_summary(
    account_id: int | None = None,
    person_id: int | None = None,
    month: str | None = Query(None, description="Optional YYYY-MM filter"),
    start_date: date | None = Query(None, description="Inclusive start date"),
    end_date: date | None = Query(None, description="Inclusive end date"),
    db: Session = Depends(get_db),
):
    q = db.query(ExternalFundingLink).join(
        Transaction, ExternalFundingLink.transaction_id == Transaction.id
    )
    if account_id is not None:
        q = q.filter(Transaction.account_id == account_id)
    if person_id is not None:
        q = q.join(Account, Transaction.account_id == Account.id).filter(
            Account.person_id == person_id
        )

    if month is not None:
        if not re.fullmatch(r"\d{4}-\d{2}", month):
            raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")
        y, m = month.split("-")
        year = int(y)
        mon = int(m)
        if mon < 1 or mon > 12:
            raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")
        month_start = date(year, mon, 1)
        month_end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
        q = q.filter(Transaction.date >= month_start, Transaction.date < month_end)

    if start_date is not None:
        q = q.filter(Transaction.date >= start_date)
    if end_date is not None:
        q = q.filter(Transaction.date <= end_date)

    funding_in_total = (
        q.filter(ExternalFundingLink.link_type == "funding_in")
        .with_entities(func.coalesce(func.sum(ExternalFundingLink.linked_amount), 0.0))
        .scalar()
    )
    funding_out_total = (
        q.filter(ExternalFundingLink.link_type == "funding_out")
        .with_entities(func.coalesce(func.sum(ExternalFundingLink.linked_amount), 0.0))
        .scalar()
    )
    links_count = q.count()
    funding_in = round(float(funding_in_total or 0.0), 2)
    funding_out = round(float(funding_out_total or 0.0), 2)
    return ExternalFundingSummaryRead(
        funding_in_total=funding_in,
        funding_out_total=funding_out,
        net_external_flow=round(funding_in - funding_out, 2),
        links_count=links_count,
    )
