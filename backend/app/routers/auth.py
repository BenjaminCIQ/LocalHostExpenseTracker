from datetime import datetime, timedelta
import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_optional_authenticated_user
from app.models.auth import AuthSession, PersonCredential, SecurityEvent
from app.models.person import Person
from app.schemas.auth import (
    AuthBootstrapRequest,
    AuthLoginRequest,
    AuthMeResponse,
    AuthOptionsResponse,
    AuthPersonOption,
    AuthPersonRead,
    AuthSetupFirstRequest,
)
from app.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    session_expiry,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _log_security_event(
    db: Session,
    *,
    request: Request,
    event_type: str,
    severity: str,
    message: str,
    person_id: int | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        SecurityEvent(
            person_id=person_id,
            event_type=event_type,
            severity=severity,
            message=message,
            ip_address=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
            metadata_json=json.dumps(metadata or {}),
        )
    )


def _set_auth_cookie(response: Response, token: str, expires_at: datetime):
    max_age = max(0, int((expires_at - datetime.utcnow()).total_seconds()))
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
        path="/",
    )


def _clear_auth_cookie(response: Response):
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
    )


def _create_session(
    db: Session,
    *,
    person_id: int,
    remember_me: bool,
    request: Request,
) -> tuple[str, datetime]:
    token = generate_session_token()
    expires_at = session_expiry(remember_me=remember_me)
    session = AuthSession(
        person_id=person_id,
        token_hash=hash_session_token(token),
        user_agent=request.headers.get("user-agent", ""),
        ip_address=request.client.host if request.client else "",
        expires_at=expires_at,
    )
    db.add(session)
    _log_security_event(
        db,
        request=request,
        event_type="login_success",
        severity="info",
        message="Successful login.",
        person_id=person_id,
    )
    db.commit()
    return token, expires_at


@router.get("/options", response_model=AuthOptionsResponse)
def auth_options(db: Session = Depends(get_db)):
    people = db.query(Person).order_by(Person.name.asc()).all()
    credential_person_ids = {
        row[0] for row in db.query(PersonCredential.person_id).all()
    }
    return AuthOptionsResponse(
        persons=[
            AuthPersonOption(
                id=p.id,
                name=p.name,
                requires_password_setup=p.id not in credential_person_ids,
            )
            for p in people
        ]
    )


@router.post("/setup-first", response_model=AuthMeResponse)
def setup_first_user(
    payload: AuthSetupFirstRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Create the first user (person + password) when no one has credentials yet."""
    has_any_credential = db.query(PersonCredential).first() is not None
    if has_any_credential:
        raise HTTPException(
            status_code=403,
            detail="First user already exists. Use login or set-password flow.",
        )
    name = payload.name.strip()
    existing = db.query(Person).filter(Person.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Person with this name already exists")
    person = Person(name=name)
    db.add(person)
    db.flush()
    pwd_hash, salt, iterations = hash_password(payload.password)
    cred = PersonCredential(
        person_id=person.id,
        password_hash=pwd_hash,
        password_salt=salt,
        password_iterations=iterations,
    )
    db.add(cred)
    token, expires_at = _create_session(
        db,
        person_id=person.id,
        remember_me=payload.remember_me,
        request=request,
    )
    _set_auth_cookie(response, token, expires_at)
    return AuthMeResponse(
        authenticated=True,
        person=AuthPersonRead(id=person.id, name=person.name, is_admin=person.is_admin),
        expires_at=expires_at,
    )


@router.post("/bootstrap", response_model=AuthMeResponse)
def bootstrap_auth(
    payload: AuthBootstrapRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    person = db.get(Person, payload.person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    existing = db.query(PersonCredential).filter(PersonCredential.person_id == person.id).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Password already set for this person")
    pwd_hash, salt, iterations = hash_password(payload.password)
    cred = PersonCredential(
        person_id=person.id,
        password_hash=pwd_hash,
        password_salt=salt,
        password_iterations=iterations,
    )
    db.add(cred)
    token, expires_at = _create_session(
        db,
        person_id=person.id,
        remember_me=payload.remember_me,
        request=request,
    )
    _set_auth_cookie(response, token, expires_at)
    return AuthMeResponse(
        authenticated=True,
        person=AuthPersonRead(id=person.id, name=person.name, is_admin=person.is_admin),
        expires_at=expires_at,
    )


@router.post("/login", response_model=AuthMeResponse)
def login(
    payload: AuthLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    person = db.get(Person, payload.person_id)
    if person is None:
        _log_security_event(
            db,
            request=request,
            event_type="login_unknown_person",
            severity="warning",
            message="Login attempt for unknown person id.",
            metadata={"person_id": payload.person_id},
        )
        db.commit()
        raise HTTPException(status_code=404, detail="Person not found")
    cred = db.query(PersonCredential).filter(PersonCredential.person_id == person.id).first()
    if cred is None:
        _log_security_event(
            db,
            request=request,
            event_type="login_no_password",
            severity="warning",
            message="Login attempt before password setup.",
            person_id=person.id,
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Password not set yet. Use bootstrap first.")
    if cred.lockout_until and cred.lockout_until > now:
        remaining = int((cred.lockout_until - now).total_seconds())
        _log_security_event(
            db,
            request=request,
            event_type="login_blocked_lockout",
            severity="warning",
            message="Login blocked due to temporary lockout.",
            person_id=person.id,
            metadata={"lockout_until": cred.lockout_until.isoformat()},
        )
        db.commit()
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {max(1, remaining)} seconds.",
        )
    ok = verify_password(
        payload.password,
        expected_hash=cred.password_hash,
        salt_b64=cred.password_salt,
        iterations=cred.password_iterations,
    )
    if not ok:
        window_start = now - timedelta(minutes=settings.auth_lockout_window_minutes)
        if cred.last_failed_login_at is None or cred.last_failed_login_at < window_start:
            cred.failed_login_attempts = 0
        cred.failed_login_attempts = int(cred.failed_login_attempts or 0) + 1
        cred.last_failed_login_at = now
        locked_now = False
        if cred.failed_login_attempts >= settings.auth_lockout_threshold:
            cred.lockout_until = now + timedelta(minutes=settings.auth_lockout_minutes)
            cred.failed_login_attempts = 0
            locked_now = True
        _log_security_event(
            db,
            request=request,
            event_type="login_failed",
            severity="warning" if not locked_now else "critical",
            message="Invalid password." if not locked_now else "Account temporarily locked after failed logins.",
            person_id=person.id,
            metadata={"locked_now": locked_now},
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid password")
    cred.failed_login_attempts = 0
    cred.last_failed_login_at = None
    cred.lockout_until = None
    token, expires_at = _create_session(
        db,
        person_id=person.id,
        remember_me=payload.remember_me,
        request=request,
    )
    _set_auth_cookie(response, token, expires_at)
    return AuthMeResponse(
        authenticated=True,
        person=AuthPersonRead(id=person.id, name=person.name, is_admin=person.is_admin),
        expires_at=expires_at,
    )


@router.post("/logout", response_model=AuthMeResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(settings.auth_cookie_name)
    if token:
        token_hash = hash_session_token(token)
        session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.utcnow()
            _log_security_event(
                db,
                request=request,
                event_type="logout",
                severity="info",
                message="Session revoked by logout.",
                person_id=session.person_id,
            )
            db.commit()
    _clear_auth_cookie(response)
    return AuthMeResponse(authenticated=False, person=None, expires_at=None)


@router.get("/me", response_model=AuthMeResponse)
def me(
    request: Request,
    person: Person | None = Depends(get_optional_authenticated_user),
    db: Session = Depends(get_db),
):
    if person is None:
        return AuthMeResponse(authenticated=False, person=None, expires_at=None)
    expires_at = None
    token = request.cookies.get(settings.auth_cookie_name)
    if token:
        token_hash = hash_session_token(token)
        session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
        if session is not None:
            expires_at = session.expires_at
    return AuthMeResponse(
        authenticated=True,
        person=AuthPersonRead(id=person.id, name=person.name, is_admin=person.is_admin),
        expires_at=expires_at,
    )
