from app.events.bus import Event, event_bus
from app.models.category import Category
from app.models.classification_log import ClassificationLog
from app.models.transaction import Transaction
from app.services.classification_service import classify_transaction_manual


def test_manual_classification_sets_fields_and_logs(seeded_db, classifier):
    # Pick a real category from seeded DB (anything non-parent works).
    cat = seeded_db.query(Category).filter(Category.parent_id.isnot(None)).first()
    assert cat is not None

    txn = Transaction(
        account_id=1,
        import_batch_id=None,
        date=__import__("datetime").date(2026, 1, 1),
        amount=-10.0,
        raw_description="POS 1234 REWE SAGT DANKE",
        description="REWE SAGT DANKE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="x" * 64,
    )
    seeded_db.add(txn)
    seeded_db.commit()
    seeded_db.refresh(txn)

    seen = []
    old_subs = {k: list(v) for k, v in event_bus._subscribers.items()}  # type: ignore[attr-defined]

    def handler(evt: Event):
        seen.append(evt.data["transaction_id"])

    try:
        event_bus._subscribers.clear()  # type: ignore[attr-defined]
        event_bus.subscribe("transaction_classified", handler)

        updated = classify_transaction_manual(
            seeded_db,
            transaction=txn,
            category_id=cat.id,
            merchant="REWE (edited)",
            classifier=classifier,
        )

        assert updated.final_category_id == cat.id
        assert updated.classification_source == "human"
        assert updated.confidence == 1.0
        assert updated.merchant == "REWE (edited)"

        log = (
            seeded_db.query(ClassificationLog)
            .filter(ClassificationLog.transaction_id == txn.id)
            .first()
        )
        assert log is not None
        assert log.final_category_id == cat.id
        assert log.classification_source == "human"

        assert seen == [txn.id]
    finally:
        event_bus._subscribers.clear()  # type: ignore[attr-defined]
        event_bus._subscribers.update(old_subs)  # type: ignore[attr-defined]

