from datetime import datetime

from pydantic import BaseModel, Field


class AuthPersonOption(BaseModel):
    id: int
    name: str
    requires_password_setup: bool


class AuthOptionsResponse(BaseModel):
    persons: list[AuthPersonOption]


class AuthBootstrapRequest(BaseModel):
    person_id: int
    password: str = Field(min_length=8, max_length=200)
    remember_me: bool = True


class AuthLoginRequest(BaseModel):
    person_id: int
    password: str = Field(min_length=1, max_length=200)
    remember_me: bool = False


class AuthSetupFirstRequest(BaseModel):
    """Create the first user when no one has a password yet."""

    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=200)
    remember_me: bool = True


class AuthPersonRead(BaseModel):
    id: int
    name: str
    is_admin: bool = False


class AuthMeResponse(BaseModel):
    authenticated: bool
    person: AuthPersonRead | None = None
    expires_at: datetime | None = None
