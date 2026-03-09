import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.parsing_rule import ParsingRule
from app.schemas.parsing_rule import (
    ParsingRuleCreate,
    ParsingRuleRead,
    ParsingRuleTestRequest,
    ParsingRuleTestResponse,
    ParsingRuleUpdate,
)

router = APIRouter(prefix="/api/parsing-rules", tags=["parsing-rules"])


@router.get("/", response_model=list[ParsingRuleRead])
def list_rules(db: Session = Depends(get_db)):
    return (
        db.query(ParsingRule)
        .order_by(ParsingRule.priority.asc(), ParsingRule.name.asc())
        .all()
    )


@router.post("/", response_model=ParsingRuleRead, status_code=201)
def create_rule(payload: ParsingRuleCreate, db: Session = Depends(get_db)):
    exists = db.query(ParsingRule.id).filter(ParsingRule.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=409, detail="Parsing rule name already exists")
    r = ParsingRule(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/{rule_id}", response_model=ParsingRuleRead)
def update_rule(rule_id: int, payload: ParsingRuleUpdate, db: Session = Depends(get_db)):
    r = db.get(ParsingRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Parsing rule not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.get(ParsingRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Parsing rule not found")
    db.delete(r)
    db.commit()


@router.post("/{rule_id}/test", response_model=ParsingRuleTestResponse)
def test_rule(rule_id: int, payload: ParsingRuleTestRequest, db: Session = Depends(get_db)):
    r = db.get(ParsingRule, rule_id)
    if not r:
        raise HTTPException(status_code=404, detail="Parsing rule not found")
    m = re.search(r.match_regex, payload.sample_text, flags=re.IGNORECASE)
    if not m:
        return ParsingRuleTestResponse(matches=False)
    try:
        extracted = m.group(r.merchant_group)
    except Exception:
        extracted = None
    return ParsingRuleTestResponse(matches=True, extracted_merchant=extracted)

