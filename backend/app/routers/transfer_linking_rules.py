from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.transfer_linking_rule import TransferLinkingRule
from app.schemas.transfer_linking_rule import (
    ApplyRulesResponse,
    TransferLinkingRuleCreate,
    TransferLinkingRuleRead,
    TransferLinkingRuleUpdate,
)
from app.services.transfer_reconciliation_service import apply_transfer_linking_rules

router = APIRouter(prefix="/api/transfer-linking-rules", tags=["transfer-linking-rules"])


@router.get("/", response_model=list[TransferLinkingRuleRead])
def list_rules(db: Session = Depends(get_db)):
    return (
        db.query(TransferLinkingRule)
        .order_by(TransferLinkingRule.name.asc())
        .all()
    )


@router.post("/", response_model=TransferLinkingRuleRead, status_code=201)
def create_rule(payload: TransferLinkingRuleCreate, db: Session = Depends(get_db)):
    if payload.source_account_id == payload.target_account_id:
        raise HTTPException(
            status_code=400,
            detail="Source and target accounts must be different",
        )
    r = TransferLinkingRule(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.post("/apply", response_model=ApplyRulesResponse)
def apply_rules(
    db: Session = Depends(get_db),
    person_id: int | None = Query(None, description="Restrict to this person's accounts"),
):
    result = apply_transfer_linking_rules(db, person_id=person_id)
    return ApplyRulesResponse(
        pairs_linked=result["pairs_linked"],
        pairs_ambiguous=result["pairs_ambiguous"],
        pairs_no_rule=result["pairs_no_rule"],
    )


@router.get("/{rule_id}", response_model=TransferLinkingRuleRead)
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.get(TransferLinkingRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Transfer linking rule not found")
    return r


@router.put("/{rule_id}", response_model=TransferLinkingRuleRead)
def update_rule(
    rule_id: int, payload: TransferLinkingRuleUpdate, db: Session = Depends(get_db)
):
    r = db.get(TransferLinkingRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Transfer linking rule not found")
    data = payload.model_dump(exclude_unset=True)
    if "source_account_id" in data and "target_account_id" in data:
        if data["source_account_id"] == data["target_account_id"]:
            raise HTTPException(
                status_code=400,
                detail="Source and target accounts must be different",
            )
    elif "source_account_id" in data and data["source_account_id"] == r.target_account_id:
        raise HTTPException(
            status_code=400,
            detail="Source and target accounts must be different",
        )
    elif "target_account_id" in data and data["target_account_id"] == r.source_account_id:
        raise HTTPException(
            status_code=400,
            detail="Source and target accounts must be different",
        )
    for k, v in data.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.get(TransferLinkingRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Transfer linking rule not found")
    db.delete(r)
    db.commit()
