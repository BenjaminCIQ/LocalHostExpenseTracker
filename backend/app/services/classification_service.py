import logging

from sqlalchemy.orm import Session

from app.events.bus import TransactionClassifiedEvent, event_bus
from app.ml.classifier import MLClassifier
from app.ml.trainer import retrain_classifier, should_retrain
from app.models.classification_log import ClassificationLog
from app.models.transaction import Transaction
from app.pipeline.base import TransactionContext
from app.pipeline.pipeline import ClassificationPipeline

logger = logging.getLogger(__name__)


def classify_transaction_manual(
    db: Session,
    transaction: Transaction,
    category_id: int,
    merchant: str | None,
    classifier: MLClassifier,
) -> Transaction:
    """Apply a human classification to a transaction.

    This is the primary training signal: every manual classification feeds
    the event bus, which updates the ML dataset and merchant memory.
    """
    transaction.final_category_id = category_id
    transaction.classification_source = "human"
    transaction.confidence = 1.0

    if merchant is not None:
        transaction.merchant = merchant

    log = ClassificationLog(
        transaction_id=transaction.id,
        predicted_category_id=transaction.predicted_category_id,
        final_category_id=category_id,
        classification_source="human",
        confidence=1.0,
        pipeline_stage="human",
    )
    db.add(log)
    db.commit()

    event_bus.publish(TransactionClassifiedEvent(
        data={
            "transaction_id": transaction.id,
            "description": transaction.description,
            "merchant": transaction.merchant,
            "amount": transaction.amount,
            "category_id": category_id,
            "source": "human",
        }
    ))

    if should_retrain(db, classifier):
        retrain_classifier(db, classifier)

    return transaction


def run_pipeline_on_transaction(
    db: Session,
    transaction: Transaction,
    pipeline: ClassificationPipeline,
) -> Transaction:
    """Run the classification pipeline on a single transaction.

    Stores the prediction but does NOT set final_category -- the user
    must confirm or override predictions.
    """
    ctx = TransactionContext(
        transaction_id=transaction.id,
        description=transaction.description,
        raw_description=transaction.raw_description,
        merchant=transaction.merchant,
        amount=transaction.amount,
        date=str(transaction.date),
    )
    result = pipeline.classify(ctx)

    if result.is_classified:
        transaction.predicted_category_id = result.category_id
        transaction.confidence = result.confidence

        log = ClassificationLog(
            transaction_id=transaction.id,
            predicted_category_id=result.category_id,
            classification_source=result.source,
            confidence=result.confidence,
            pipeline_stage=result.stage_name,
        )
        db.add(log)
        db.commit()

    return transaction


def run_pipeline_on_unclassified(
    db: Session,
    pipeline: ClassificationPipeline,
) -> int:
    """Run pipeline on all transactions that lack predictions. Returns count processed."""
    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.predicted_category_id.is_(None),
            Transaction.final_category_id.is_(None),
        )
        .all()
    )
    count = 0
    for txn in transactions:
        run_pipeline_on_transaction(db, txn, pipeline)
        count += 1
    return count
