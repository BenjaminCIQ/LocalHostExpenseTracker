import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.events.bus import Event
from app.models.training_data import TrainingData

logger = logging.getLogger(__name__)


def handle_transaction_classified(event: Event) -> None:
    """Add or update a labeled example in the ML training dataset."""
    data = event.data
    db: Session = SessionLocal()
    try:
        existing = (
            db.query(TrainingData)
            .filter(TrainingData.transaction_id == data["transaction_id"])
            .first()
        )
        if existing:
            existing.text_features = data.get("raw_description") or data["description"]
            existing.merchant = data.get("merchant", "")
            existing.amount = data["amount"]
            existing.category_id = data["category_id"]
            existing.source = data["source"]
        else:
            entry = TrainingData(
                transaction_id=data["transaction_id"],
                text_features=data.get("raw_description") or data["description"],
                merchant=data.get("merchant", ""),
                amount=data["amount"],
                category_id=data["category_id"],
                source=data["source"],
            )
            db.add(entry)
        db.commit()
        logger.info(
            "Training data updated for transaction %s", data["transaction_id"]
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to update training data")
    finally:
        db.close()
