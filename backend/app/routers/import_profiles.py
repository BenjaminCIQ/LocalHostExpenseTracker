from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.import_profile import ImportProfile
from app.schemas.import_profile import (
    ImportProfileCreate,
    ImportProfileRead,
    ImportProfileUpdate,
    columns_to_json,
    json_to_columns,
)

router = APIRouter(prefix="/api/import-profiles", tags=["import-profiles"])


def _to_read(p: ImportProfile) -> ImportProfileRead:
    return ImportProfileRead(
        id=p.id,
        name=p.name,
        format=p.format,
        delimiter=p.delimiter,
        date_column=p.date_column,
        amount_column=p.amount_column,
        currency_column=p.currency_column,
        merchant_columns=json_to_columns(p.merchant_columns_json),
        description_columns=json_to_columns(p.description_columns_json),
        enabled=p.enabled,
    )


@router.get("/", response_model=list[ImportProfileRead])
def list_profiles(db: Session = Depends(get_db)):
    profiles = db.query(ImportProfile).order_by(ImportProfile.name.asc()).all()
    return [_to_read(p) for p in profiles]


@router.post("/", response_model=ImportProfileRead)
def create_profile(payload: ImportProfileCreate, db: Session = Depends(get_db)):
    exists = (
        db.query(ImportProfile.id).filter(ImportProfile.name == payload.name).first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Profile name already exists")

    p = ImportProfile(
        name=payload.name,
        format=payload.format,
        delimiter=payload.delimiter,
        date_column=payload.date_column,
        amount_column=payload.amount_column,
        currency_column=payload.currency_column,
        merchant_columns_json=columns_to_json(payload.merchant_columns),
        description_columns_json=columns_to_json(payload.description_columns),
        enabled=payload.enabled,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_read(p)


@router.put("/{profile_id}", response_model=ImportProfileRead)
def update_profile(
    profile_id: int, payload: ImportProfileUpdate, db: Session = Depends(get_db)
):
    p = db.get(ImportProfile, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")

    if payload.name is not None and payload.name != p.name:
        exists = (
            db.query(ImportProfile.id)
            .filter(ImportProfile.name == payload.name)
            .first()
        )
        if exists:
            raise HTTPException(status_code=409, detail="Profile name already exists")
        p.name = payload.name

    if payload.delimiter is not None:
        p.delimiter = payload.delimiter
    if payload.date_column is not None:
        p.date_column = payload.date_column
    if payload.amount_column is not None:
        p.amount_column = payload.amount_column
    if payload.currency_column is not None:
        p.currency_column = payload.currency_column
    if payload.merchant_columns is not None:
        p.merchant_columns_json = columns_to_json(payload.merchant_columns)
    if payload.description_columns is not None:
        p.description_columns_json = columns_to_json(payload.description_columns)
    if payload.enabled is not None:
        p.enabled = payload.enabled

    db.commit()
    db.refresh(p)
    return _to_read(p)


@router.delete("/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    p = db.get(ImportProfile, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(p)
    db.commit()
    return {"deleted": True}

