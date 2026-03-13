"""User preferences and settings (e.g. widget layout) stored per person."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_authenticated_user
from app.models.person import Person

router = APIRouter(prefix="/api/settings", tags=["settings"])

WIDGET_LAYOUT_KEY_PREFIX = "widget-layout-"


@router.get("/widget-layout/{page}")
def get_widget_layout(
    page: str,
    person: Person = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Return stored widget layout for the current user and page, or null if none."""
    key = f"{WIDGET_LAYOUT_KEY_PREFIX}{page}"
    row = db.execute(
        text("SELECT value FROM user_preferences WHERE person_id = :pid AND key = :key"),
        {"pid": person.id, "key": key},
    ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except (TypeError, ValueError):
        return None


@router.put("/widget-layout/{page}")
def save_widget_layout(
    page: str,
    payload: dict,
    person: Person = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """Store widget layout for the current user and page."""
    key = f"{WIDGET_LAYOUT_KEY_PREFIX}{page}"
    value = json.dumps(payload)
    now = datetime.utcnow()
    db.execute(
        text(
            "INSERT INTO user_preferences (person_id, key, value, updated_at) "
            "VALUES (:pid, :key, :value, :now) "
            "ON CONFLICT (person_id, key) DO UPDATE SET value = :value, updated_at = :now"
        ),
        {"pid": person.id, "key": key, "value": value, "now": now},
    )
    db.commit()
    return {"ok": True}
