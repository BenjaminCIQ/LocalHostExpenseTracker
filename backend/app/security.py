import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from app.config import settings


def hash_password(password: str, *, salt: bytes | None = None, iterations: int | None = None) -> tuple[str, str, int]:
    use_salt = salt or secrets.token_bytes(16)
    use_iterations = iterations or settings.auth_password_iterations
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), use_salt, use_iterations)
    return (
        base64.b64encode(digest).decode("ascii"),
        base64.b64encode(use_salt).decode("ascii"),
        use_iterations,
    )


def verify_password(password: str, *, expected_hash: str, salt_b64: str, iterations: int) -> bool:
    try:
        salt = base64.b64decode(salt_b64.encode("ascii"))
    except Exception:
        return False
    computed_hash, _, _ = hash_password(password, salt=salt, iterations=iterations)
    return hmac.compare_digest(expected_hash, computed_hash)


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


def hash_session_token(token: str) -> str:
    return hmac.new(
        settings.auth_token_pepper.encode("utf-8"),
        token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def session_expiry(*, remember_me: bool) -> datetime:
    now = datetime.utcnow()
    if remember_me:
        return now + timedelta(days=settings.auth_remember_days)
    return now + timedelta(hours=settings.auth_session_hours)
