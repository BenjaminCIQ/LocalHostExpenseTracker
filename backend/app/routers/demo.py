"""Demo tour cleanup: delete accounts and related data created during the guided tour."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_authenticated_user
from app.models.account import Account
from app.models.classification_log import ClassificationLog
from app.models.duplicate_override import DuplicateOverride
from app.models.external_account import (
    ExternalAccount,
    ExternalFundingLink,
    ExternalValuationSnapshot,
)
from app.models.import_batch import ImportBatch
from app.models.person import Person
from app.models.transaction import Transaction
from app.models.transfer_linking_rule import TransferLinkingRule
from app.models.training_data import TrainingData

router = APIRouter(prefix="/api/demo", tags=["demo"])


class DemoCleanupPayload(BaseModel):
    account_ids: list[int]
    external_account_ids: list[int] | None = None


def _transaction_ids_for_accounts(db: Session, account_ids: list[int]) -> list[int]:
    if not account_ids:
        return []
    rows = db.execute(
        select(Transaction.id).where(Transaction.account_id.in_(account_ids))
    ).fetchall()
    return [r[0] for r in rows]


@router.post("/cleanup", status_code=204)
def demo_cleanup(
    payload: DemoCleanupPayload,
    db: Session = Depends(get_db),
    person: Person = Depends(require_authenticated_user),
):
    """Delete demo accounts and optionally external accounts with all related data.
    Only accounts owned by the current user (person_id match) are deleted.
    """
    account_ids = list(payload.account_ids) if payload.account_ids else []
    external_ids = list(payload.external_account_ids or [])

    # Verify accounts belong to current user
    if account_ids:
        accounts = db.query(Account).filter(Account.id.in_(account_ids)).all()
        for acc in accounts:
            if acc.person_id is not None and acc.person_id != person.id:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot delete an account that does not belong to you",
                )
        valid_account_ids = [a.id for a in accounts]
    else:
        valid_account_ids = []

    # Verify external accounts belong to current user
    if external_ids:
        ext_accounts = (
            db.query(ExternalAccount).filter(ExternalAccount.id.in_(external_ids)).all()
        )
        for ext in ext_accounts:
            if ext.person_id is not None and ext.person_id != person.id:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot delete an external account that does not belong to you",
                )
        valid_external_ids = [e.id for e in ext_accounts]
    else:
        valid_external_ids = []

    txn_ids = _transaction_ids_for_accounts(db, valid_account_ids)

    # Delete in dependency order for accounts
    if txn_ids:
        db.query(ExternalFundingLink).filter(
            ExternalFundingLink.transaction_id.in_(txn_ids)
        ).delete(synchronize_session=False)
        db.query(ClassificationLog).filter(
            ClassificationLog.transaction_id.in_(txn_ids)
        ).delete(synchronize_session=False)
        db.query(TrainingData).filter(
            TrainingData.transaction_id.in_(txn_ids)
        ).delete(synchronize_session=False)

    if valid_account_ids:
        db.query(Transaction).filter(
            Transaction.account_id.in_(valid_account_ids)
        ).delete(synchronize_session=False)
        db.query(DuplicateOverride).filter(
            DuplicateOverride.account_id.in_(valid_account_ids)
        ).delete(synchronize_session=False)
        db.query(TransferLinkingRule).filter(
            (TransferLinkingRule.source_account_id.in_(valid_account_ids))
            | (TransferLinkingRule.target_account_id.in_(valid_account_ids))
        ).delete(synchronize_session=False)
        db.query(ImportBatch).filter(
            ImportBatch.account_id.in_(valid_account_ids)
        ).delete(synchronize_session=False)
        db.query(Account).filter(Account.id.in_(valid_account_ids)).delete(
            synchronize_session=False
        )

    # External accounts: funding links reference transactions; delete links by external_account_id
    if valid_external_ids:
        db.query(ExternalFundingLink).filter(
            ExternalFundingLink.external_account_id.in_(valid_external_ids)
        ).delete(synchronize_session=False)
        db.query(ExternalValuationSnapshot).filter(
            ExternalValuationSnapshot.external_account_id.in_(valid_external_ids)
        ).delete(synchronize_session=False)
        db.query(ExternalAccount).filter(
            ExternalAccount.id.in_(valid_external_ids)
        ).delete(synchronize_session=False)

    db.commit()
