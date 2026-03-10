"""Singleton dependencies shared across the application."""

from datetime import datetime

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.auth import AuthSession
from app.models.person import Person
from app.ml.classifier import MLClassifier
from app.ml.name_suggester import CanonicalNameSuggester
from app.pipeline.ml_stage import MLClassifierStage
from app.pipeline.override_stage import UserOverrideStage
from app.pipeline.pipeline import ClassificationPipeline
from app.pipeline.rule_stage import RuleEngineStage
from app.security import hash_session_token

_classifier: MLClassifier | None = None
_name_suggester: CanonicalNameSuggester | None = None
_pipeline: ClassificationPipeline | None = None


def get_classifier() -> MLClassifier:
    global _classifier
    if _classifier is None:
        _classifier = MLClassifier()
    return _classifier


def get_name_suggester() -> CanonicalNameSuggester:
    global _name_suggester
    if _name_suggester is None:
        _name_suggester = CanonicalNameSuggester()
    return _name_suggester


def get_pipeline() -> ClassificationPipeline:
    global _pipeline
    if _pipeline is None:
        classifier = get_classifier()
        _pipeline = ClassificationPipeline(
            stages=[
                UserOverrideStage(),
                RuleEngineStage(),
                MLClassifierStage(classifier),
            ]
        )
    return _pipeline


def get_optional_authenticated_user(
    request: Request,
    db: Session = Depends(get_db),
) -> Person | None:
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        return None
    token_hash = hash_session_token(token)
    session = (
        db.query(AuthSession)
        .join(Person, AuthSession.person_id == Person.id)
        .filter(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not session:
        return None
    return session.person


def require_authenticated_user(
    person: Person | None = Depends(get_optional_authenticated_user),
) -> Person:
    if person is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return person


def require_admin_user(
    person: Person = Depends(require_authenticated_user),
) -> Person:
    if not getattr(person, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return person
