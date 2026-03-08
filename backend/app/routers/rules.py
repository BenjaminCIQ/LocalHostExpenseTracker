from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.category import Category
from app.models.rule import Rule, RuleCondition
from app.pipeline.rule_stage import RuleEngineStage
from app.pipeline.base import TransactionContext
from app.schemas.rule import (
    RuleCreate,
    RuleRead,
    RuleTestRequest,
    RuleTestResponse,
    RuleToggleRequest,
    RuleUpdate,
)

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("/", response_model=list[RuleRead])
def list_rules(db: Session = Depends(get_db)):
    return (
        db.query(Rule)
        .options(joinedload(Rule.conditions))
        .order_by(Rule.priority.desc(), Rule.id.desc())
        .all()
    )


@router.post("/", response_model=RuleRead, status_code=201)
def create_rule(payload: RuleCreate, db: Session = Depends(get_db)):
    cat = db.get(Category, payload.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    rule = Rule(
        name=payload.name,
        category_id=payload.category_id,
        logic=payload.logic,
        priority=payload.priority,
        enabled=payload.enabled,
    )
    db.add(rule)
    db.flush()

    for cond in payload.conditions:
        db.add(
            RuleCondition(
                rule_id=rule.id,
                field=cond.field,
                operator=cond.operator,
                value=cond.value,
            )
        )

    db.commit()
    db.refresh(rule)
    rule = (
        db.query(Rule)
        .options(joinedload(Rule.conditions))
        .filter(Rule.id == rule.id)
        .first()
    )
    assert rule is not None
    return rule


@router.put("/{rule_id}", response_model=RuleRead)
def update_rule(rule_id: int, payload: RuleUpdate, db: Session = Depends(get_db)):
    rule = db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        cat = db.get(Category, data["category_id"])
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")

    if "conditions" in data:
        # Replace conditions.
        db.query(RuleCondition).filter(RuleCondition.rule_id == rule_id).delete()
        for cond in data["conditions"] or []:
            db.add(
                RuleCondition(
                    rule_id=rule_id,
                    field=cond["field"],
                    operator=cond["operator"],
                    value=cond["value"],
                )
            )
        data.pop("conditions", None)

    for k, v in data.items():
        setattr(rule, k, v)

    db.commit()
    updated = (
        db.query(Rule)
        .options(joinedload(Rule.conditions))
        .filter(Rule.id == rule_id)
        .first()
    )
    assert updated is not None
    return updated


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()


@router.patch("/{rule_id}/toggle", response_model=RuleRead)
def toggle_rule(
    rule_id: int, payload: RuleToggleRequest, db: Session = Depends(get_db)
):
    rule = db.get(Rule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.enabled = payload.enabled
    db.commit()
    updated = (
        db.query(Rule)
        .options(joinedload(Rule.conditions))
        .filter(Rule.id == rule_id)
        .first()
    )
    assert updated is not None
    return updated


@router.post("/{rule_id}/test", response_model=RuleTestResponse)
def test_rule(rule_id: int, payload: RuleTestRequest, db: Session = Depends(get_db)):
    rule = (
        db.query(Rule)
        .options(joinedload(Rule.conditions))
        .filter(Rule.id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    ctx = TransactionContext(
        transaction_id=0,
        description=payload.description,
        raw_description=payload.description,
        merchant=payload.merchant,
        amount=payload.amount,
        date="",
    )
    stage = RuleEngineStage(session_factory=lambda: db)
    matches = stage.evaluate_rule(rule, ctx)
    return RuleTestResponse(matches=matches)

