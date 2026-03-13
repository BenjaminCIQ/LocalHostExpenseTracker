from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from sqlalchemy import func, select

from app.database import get_db
from app.models.account import Account
from app.models.person import Person
from app.models.transaction import Transaction
from app.schemas.account import AccountCreate, AccountRead, AccountUpdate

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("/", response_model=list[AccountRead])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()


@router.post("/", response_model=AccountRead, status_code=201)
def create_account(payload: AccountCreate, db: Session = Depends(get_db)):
    if payload.person_id is not None:
        if db.get(Person, payload.person_id) is None:
            raise HTTPException(status_code=404, detail="Person not found")
    account = Account(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountRead)
def update_account(account_id: int, payload: AccountUpdate, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    data = payload.model_dump(exclude_unset=True)
    if "person_id" in data and data["person_id"] is not None:
        if db.get(Person, data["person_id"]) is None:
            raise HTTPException(status_code=404, detail="Person not found")
    for k, v in data.items():
        setattr(account, k, v)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    count = db.scalar(select(func.count()).select_from(Transaction).where(Transaction.account_id == account_id))
    if (count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete account that has transactions. Remove or reassign transactions first.",
        )
    db.delete(account)
    db.commit()
