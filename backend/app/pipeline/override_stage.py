import re
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user_override import UserOverride
from app.pipeline.base import ClassificationResult, PipelineStage, TransactionContext


class UserOverrideStage(PipelineStage):
    name = "user_override"

    def __init__(self, session_factory: Callable[[], Session] = SessionLocal) -> None:
        self._session_factory = session_factory

    @property
    def enabled(self) -> bool:
        return True

    def classify(self, ctx: TransactionContext) -> ClassificationResult | None:
        text = ctx.raw_description or ctx.description
        if not text:
            return None

        db = self._session_factory()
        try:
            overrides = (
                db.query(UserOverride)
                .order_by(UserOverride.priority.desc(), UserOverride.id.desc())
                .all()
            )
        finally:
            db.close()

        lowered = text.lower()
        for ov in overrides:
            if ov.is_regex:
                try:
                    if re.search(ov.pattern, text, re.IGNORECASE):
                        return ClassificationResult(
                            category_id=ov.category_id,
                            confidence=1.0,
                            source="override",
                        )
                except re.error:
                    continue
            else:
                if ov.pattern.lower() in lowered:
                    return ClassificationResult(
                        category_id=ov.category_id,
                        confidence=1.0,
                        source="override",
                    )

        return None

