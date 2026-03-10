from datetime import datetime

from pydantic import BaseModel


class AdminPersonRead(BaseModel):
    id: int
    name: str
    is_admin: bool
    has_password: bool
    lockout_until: datetime | None = None


class AdminSetAdminRequest(BaseModel):
    is_admin: bool


class AdminSecurityEventRead(BaseModel):
    id: int
    person_id: int | None
    person_name: str | None
    event_type: str
    severity: str
    message: str
    ip_address: str
    user_agent: str
    created_at: datetime


class AdminSessionRead(BaseModel):
    id: int
    person_id: int
    person_name: str
    ip_address: str
    user_agent: str
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    revoked_at: datetime | None


class AdminSoftDeleteRequest(BaseModel):
    reason: str

