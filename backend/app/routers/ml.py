from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_classifier, get_name_suggester
from app.ml.classifier import MLClassifier
from app.ml.name_suggester import CanonicalNameSuggester
from app.ml.trainer import retrain_classifier
from app.models.canonical_name_example import CanonicalNameExample
from app.models.transaction import Transaction
from app.models.training_data import TrainingData
from app.config import settings

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.post("/retrain")
def trigger_retrain(
    db: Session = Depends(get_db),
    classifier: MLClassifier = Depends(get_classifier),
    name_suggester: CanonicalNameSuggester = Depends(get_name_suggester),
):
    category_metrics = retrain_classifier(db, classifier)
    name_metrics = name_suggester.retrain(db)
    return {
        "category_model": category_metrics,
        "name_model": name_metrics,
    }


@router.get("/status")
def ml_status(
    db: Session = Depends(get_db),
    classifier: MLClassifier = Depends(get_classifier),
    name_suggester: CanonicalNameSuggester = Depends(get_name_suggester),
):
    sample_count = db.query(TrainingData).count()
    min_required = settings.ml_min_samples_to_train
    trained_samples = classifier.trained_num_samples or 0
    samples_since_last_train = max(0, sample_count - trained_samples) if classifier.is_trained else sample_count
    ready_to_train = sample_count >= min_required
    needs_retrain = classifier.is_trained and samples_since_last_train >= settings.ml_retrain_threshold
    canonical_examples = db.query(CanonicalNameExample).count()
    potential_bootstrap_examples = (
        db.query(Transaction)
        .filter(
            Transaction.final_category_id.isnot(None),
            Transaction.merchant.isnot(None),
            Transaction.description.isnot(None),
        )
        .count()
    )
    if not classifier.is_trained:
        model_state = "collecting_data"
    elif needs_retrain:
        model_state = "stale"
    else:
        model_state = "trained"
    return {
        "is_trained": classifier.is_trained,
        "training_samples": sample_count,
        "min_samples_required": min_required,
        "training_progress_pct": round(min(100.0, (sample_count / max(1, min_required)) * 100), 1),
        "ready_to_train": ready_to_train,
        "model_state": model_state,
        "last_trained_at": classifier.last_trained_at,
        "current_accuracy": classifier.cross_val_accuracy,
        "trained_num_samples": classifier.trained_num_samples,
        "trained_num_classes": classifier.trained_num_classes,
        "samples_since_last_train": samples_since_last_train,
        "retrain_threshold": settings.ml_retrain_threshold,
        "needs_retrain": needs_retrain,
        "name_model": {
            "is_trained": name_suggester.is_trained,
            "num_examples": canonical_examples,
            "potential_bootstrap_examples": potential_bootstrap_examples,
            "last_trained_at": name_suggester.last_trained_at,
        },
    }
