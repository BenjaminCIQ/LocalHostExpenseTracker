from app.ml.classifier import MLClassifier
from app.pipeline.base import (
    ClassificationResult,
    PipelineStage,
    TransactionContext,
)
from app.config import settings


class MLClassifierStage(PipelineStage):
    """Pipeline stage that uses a trained TF-IDF + Logistic Regression model."""

    name = "ml_classifier"

    def __init__(self, classifier: MLClassifier) -> None:
        self._classifier = classifier

    @property
    def enabled(self) -> bool:
        return self._classifier.is_trained

    def classify(self, ctx: TransactionContext) -> ClassificationResult | None:
        prediction = self._classifier.predict(
            ctx.raw_description or ctx.description,
            ctx.merchant,
        )
        if prediction is None:
            return None

        category_id, confidence = prediction
        if confidence < settings.ml_medium_confidence:
            return None

        return ClassificationResult(
            category_id=category_id,
            confidence=confidence,
            source="ml_classifier",
        )
