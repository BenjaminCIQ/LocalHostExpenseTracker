import json as _json
import logging
from pathlib import Path

from app.config import settings
from app.database import SessionLocal
from app.ml.classifier import MLClassifier
from app.models.category import Category
from app.pipeline.base import (
    ClassificationResult,
    PipelineStage,
    TransactionContext,
)

logger = logging.getLogger(__name__)


def _log_snippet(s: str, max_len: int = 80) -> str:
    if not s or len(s) <= max_len:
        return s or ""
    return s[:max_len] + "..."


def _category_name(category_id: int) -> str:
    db = SessionLocal()
    try:
        cat = db.get(Category, category_id)
        return cat.name if cat else f"id={category_id}"
    finally:
        db.close()

class MLClassifierStage(PipelineStage):
    """Pipeline stage that uses a trained TF-IDF + Logistic Regression model."""

    name = "ml_classifier"

    def __init__(self, classifier: MLClassifier) -> None:
        self._classifier = classifier

    @property
    def enabled(self) -> bool:
        return self._classifier.is_trained

    def classify(self, ctx: TransactionContext) -> ClassificationResult | None:
        desc = ctx.raw_description or ctx.description or ""
        prediction = self._classifier.predict(desc, ctx.merchant or "")

        if prediction is None:
            logger.info(
                "ML classifier txn_id=%s desc=%r merchant=%r -> no prediction (model not trained?)",
                ctx.transaction_id,
                _log_snippet(desc),
                _log_snippet(ctx.merchant or "", 40),
            )
            return None

        category_id, confidence = prediction
        category_name = _category_name(category_id)
        logger.info(
            "ML classifier txn_id=%s desc=%r merchant=%r -> category=%r (id=%s) confidence=%.3f",
            ctx.transaction_id,
            _log_snippet(desc),
            _log_snippet(ctx.merchant or "", 40),
            category_name,
            category_id,
            confidence,
        )

        threshold = settings.ml_medium_confidence
        accepted = confidence >= threshold
        # #region agent log
        try:
            _log = Path(__file__).resolve().parent.parent.parent.parent / "debug-2c73df.log"
            open(_log, "a", encoding="utf-8").write(_json.dumps({"sessionId": "2c73df", "hypothesisId": "H1", "location": "ml_stage.classify", "message": "threshold check", "data": {"txn_id": ctx.transaction_id, "confidence": round(confidence, 4), "threshold": threshold, "accepted": accepted, "category_id": category_id}, "timestamp": __import__("time").time_ns() // 1_000_000}) + "\n")
        except Exception:
            pass
        # #endregion
        if not accepted:
            logger.info(
                "ML classifier txn_id=%s not classified: confidence=%.3f < threshold=%.2f (category=%r id=%s)",
                ctx.transaction_id,
                confidence,
                threshold,
                category_name,
                category_id,
            )
            return None

        logger.info(
            "ML classifier txn_id=%s classified: category=%r (id=%s) confidence=%.3f",
            ctx.transaction_id,
            category_name,
            category_id,
            confidence,
        )
        return ClassificationResult(
            category_id=category_id,
            confidence=confidence,
            source="ml_classifier",
        )
