from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin_user
from app.models.auth import AuthSession, PersonCredential, SecurityEvent
from app.models.person import Person
from app.models.transaction import Transaction
from app.schemas.admin import (
    AdminPersonRead,
    AdminSecurityEventRead,
    AdminSessionRead,
    AdminSetAdminRequest,
    AdminSoftDeleteRequest,
)
from app.schemas.transaction import TransactionRead
from app.routers.transactions import _to_read

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin_user)])


@router.get("/persons", response_model=list[AdminPersonRead])
def list_people(db: Session = Depends(get_db)):
    creds = {
        cred.person_id: cred
        for cred in db.query(PersonCredential).all()
    }
    people = db.query(Person).order_by(Person.name.asc()).all()
    out: list[AdminPersonRead] = []
    for person in people:
        cred = creds.get(person.id)
        out.append(
            AdminPersonRead(
                id=person.id,
                name=person.name,
                is_admin=bool(person.is_admin),
                has_password=cred is not None,
                lockout_until=cred.lockout_until if cred else None,
            )
        )
    return out


@router.patch("/persons/{person_id}/admin", response_model=AdminPersonRead)
def set_person_admin(
    person_id: int,
    payload: AdminSetAdminRequest,
    db: Session = Depends(get_db),
):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    person.is_admin = payload.is_admin
    db.commit()
    cred = db.query(PersonCredential).filter(PersonCredential.person_id == person.id).first()
    return AdminPersonRead(
        id=person.id,
        name=person.name,
        is_admin=bool(person.is_admin),
        has_password=cred is not None,
        lockout_until=cred.lockout_until if cred else None,
    )


@router.get("/security-events", response_model=list[AdminSecurityEventRead])
def list_security_events(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SecurityEvent, Person.name)
        .outerjoin(Person, SecurityEvent.person_id == Person.id)
        .order_by(SecurityEvent.created_at.desc(), SecurityEvent.id.desc())
        .limit(limit)
        .all()
    )
    return [
        AdminSecurityEventRead(
            id=event.id,
            person_id=event.person_id,
            person_name=person_name,
            event_type=event.event_type,
            severity=event.severity,
            message=event.message,
            ip_address=event.ip_address,
            user_agent=event.user_agent,
            created_at=event.created_at,
        )
        for event, person_name in rows
    ]


@router.get("/sessions", response_model=list[AdminSessionRead])
def list_sessions(
    include_revoked: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(AuthSession).join(Person, AuthSession.person_id == Person.id)
    if not include_revoked:
        q = q.filter(AuthSession.revoked_at.is_(None), AuthSession.expires_at > datetime.utcnow())
    rows = q.order_by(AuthSession.created_at.desc()).limit(300).all()
    return [
        AdminSessionRead(
            id=row.id,
            person_id=row.person_id,
            person_name=row.person.name if row.person else f"#{row.person_id}",
            ip_address=row.ip_address,
            user_agent=row.user_agent,
            created_at=row.created_at,
            last_seen_at=row.last_seen_at,
            expires_at=row.expires_at,
            revoked_at=row.revoked_at,
        )
        for row in rows
    ]


@router.post("/sessions/{session_id}/revoke")
def revoke_session(session_id: int, db: Session = Depends(get_db)):
    session = db.get(AuthSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.revoked_at is None:
        session.revoked_at = datetime.utcnow()
        db.commit()
    return {"revoked": True}


@router.get("/transactions/deleted", response_model=list[TransactionRead])
def list_deleted_transactions(
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Transaction)
        .filter(Transaction.is_deleted.is_(True))
        .order_by(Transaction.deleted_at.desc(), Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return [_to_read(row, db) for row in rows]


@router.post("/transactions/{transaction_id}/soft-delete")
def soft_delete_transaction(
    transaction_id: int,
    payload: AdminSoftDeleteRequest,
    admin_user: Person = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn.is_deleted = True
    txn.deleted_at = datetime.utcnow()
    txn.deleted_by_person_id = admin_user.id
    txn.delete_reason = payload.reason.strip() or "Admin soft delete"
    db.add(
        SecurityEvent(
            person_id=admin_user.id,
            event_type="admin_soft_delete_transaction",
            severity="info",
            message=f"Soft deleted transaction #{transaction_id}",
            metadata_json='{"transaction_id": %d}' % transaction_id,
        )
    )
    db.commit()
    return {"deleted": True}


@router.post("/transactions/{transaction_id}/restore")
def restore_transaction(
    transaction_id: int,
    admin_user: Person = Depends(require_admin_user),
    db: Session = Depends(get_db),
):
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn.is_deleted = False
    txn.deleted_at = None
    txn.deleted_by_person_id = None
    txn.delete_reason = None
    db.add(
        SecurityEvent(
            person_id=admin_user.id,
            event_type="admin_restore_transaction",
            severity="info",
            message=f"Restored transaction #{transaction_id}",
            metadata_json='{"transaction_id": %d}' % transaction_id,
        )
    )
    db.commit()
    return {"restored": True}
