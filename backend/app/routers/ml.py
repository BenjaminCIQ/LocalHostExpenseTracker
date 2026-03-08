from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_classifier
from app.ml.classifier import MLClassifier
from app.ml.trainer import retrain_classifier
from app.models.training_data import TrainingData

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.post("/retrain")
def trigger_retrain(
    db: Session = Depends(get_db),
    classifier: MLClassifier = Depends(get_classifier),
):
    metrics = retrain_classifier(db, classifier)
    return metrics


@router.get("/status")
def ml_status(
    db: Session = Depends(get_db),
    classifier: MLClassifier = Depends(get_classifier),
):
    sample_count = db.query(TrainingData).count()
    return {
        "is_trained": classifier.is_trained,
        "training_samples": sample_count,
        "min_samples_required": 30,
    }
