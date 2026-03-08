import logging

from sqlalchemy.orm import Session

from app.ml.classifier import MLClassifier
from app.models.training_data import TrainingData
from app.config import settings

logger = logging.getLogger(__name__)


def retrain_classifier(db: Session, classifier: MLClassifier) -> dict:
    """Retrain the ML classifier using all available training data.

    Called either manually, on a schedule, or when enough new labeled
    transactions have accumulated (see config.ml_retrain_threshold).
    """
    samples = db.query(TrainingData).all()
    if len(samples) < settings.ml_min_samples_to_train:
        return {
            "status": "insufficient_data",
            "num_samples": len(samples),
            "required": settings.ml_min_samples_to_train,
        }

    texts = [s.text_features for s in samples]
    merchants = [s.merchant for s in samples]
    labels = [s.category_id for s in samples]

    metrics = classifier.train(texts, merchants, labels)
    logger.info("Retrain complete: %s", metrics)
    return metrics


def should_retrain(db: Session, classifier: MLClassifier) -> bool:
    """Check if enough new data has accumulated to warrant retraining."""
    total_samples = db.query(TrainingData).count()

    if not classifier.is_trained:
        return total_samples >= settings.ml_min_samples_to_train

    return total_samples % settings.ml_retrain_threshold == 0
