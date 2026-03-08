import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.user_override import UserOverride
from app.schemas.override import (
    OverrideTestRequest,
    OverrideTestResponse,
    UserOverrideCreate,
    UserOverrideRead,
    UserOverrideUpdate,
)

router = APIRouter(prefix="/api/overrides", tags=["overrides"])


@router.get("/", response_model=list[UserOverrideRead])
def list_overrides(db: Session = Depends(get_db)):
    return (
        db.query(UserOverride)
        .order_by(UserOverride.priority.desc(), UserOverride.id.desc())
        .all()
    )


@router.post("/", response_model=UserOverrideRead, status_code=201)
def create_override(payload: UserOverrideCreate, db: Session = Depends(get_db)):
    cat = db.get(Category, payload.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    ov = UserOverride(**payload.model_dump())
    db.add(ov)
    db.commit()
    db.refresh(ov)
    return ov


@router.put("/{override_id}", response_model=UserOverrideRead)
def update_override(
    override_id: int,
    payload: UserOverrideUpdate,
    db: Session = Depends(get_db),
):
    ov = db.get(UserOverride, override_id)
    if not ov:
        raise HTTPException(status_code=404, detail="Override not found")

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        cat = db.get(Category, data["category_id"])
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")

    for k, v in data.items():
        setattr(ov, k, v)

    db.commit()
    db.refresh(ov)
    return ov


@router.delete("/{override_id}", status_code=204)
def delete_override(override_id: int, db: Session = Depends(get_db)):
    ov = db.get(UserOverride, override_id)
    if not ov:
        raise HTTPException(status_code=404, detail="Override not found")
    db.delete(ov)
    db.commit()


@router.post("/{override_id}/test", response_model=OverrideTestResponse)
def test_override(
    override_id: int,
    payload: OverrideTestRequest,
    db: Session = Depends(get_db),
):
    ov = db.get(UserOverride, override_id)
    if not ov:
        raise HTTPException(status_code=404, detail="Override not found")

    text = payload.description or ""
    if ov.is_regex:
        try:
            matches = re.search(ov.pattern, text, re.IGNORECASE) is not None
        except re.error:
            matches = False
    else:
        matches = ov.pattern.lower() in text.lower()

    return OverrideTestResponse(matches=matches)

