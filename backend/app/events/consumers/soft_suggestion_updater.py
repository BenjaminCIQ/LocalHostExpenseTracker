import logging

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.events.bus import Event
from app.models.classification_log import ClassificationLog
from app.models.transaction import Transaction
from app.services.similarity_service import find_similar_unclassified

logger = logging.getLogger(__name__)


def handle_transaction_classified(event: Event, session_factory=SessionLocal) -> None:
    """Populate soft predictions for similar unclassified transactions.

    This is a "soft rule" system: it writes predicted_category_id/confidence
    based on similarity to a user-classified transaction, without creating
    a persistent hard rule.
    """
    data = event.data
    seed_id = data.get("transaction_id")
    category_id = data.get("category_id")
    if not seed_id or not category_id:
        return

    db: Session = session_factory()
    try:
        candidates = find_similar_unclassified(
            db,
            int(seed_id),
            limit=settings.soft_similarity_limit,
            min_score=settings.soft_similarity_min_score,
        )

        updated = 0
        for c in candidates:
            txn = db.get(Transaction, c.transaction_id)
            if txn is None:
                continue
            if txn.final_category_id is not None:
                continue

            new_conf = c.score / 100.0

            # Guardrail: do not overwrite stronger existing predictions.
            if txn.predicted_category_id is not None:
                if txn.confidence is None or txn.confidence >= new_conf:
                    continue

            txn.predicted_category_id = int(category_id)
            txn.confidence = float(new_conf)

            db.add(
                ClassificationLog(
                    transaction_id=txn.id,
                    predicted_category_id=int(category_id),
                    classification_source="soft_similarity",
                    confidence=float(new_conf),
                    pipeline_stage="soft_similarity",
                )
            )
            updated += 1

        db.commit()
        if updated:
            logger.info("Soft similarity updated %d predictions", updated)
    except Exception:
        db.rollback()
        logger.exception("Failed soft similarity update")
    finally:
        db.close()

