from datetime import date

from app.models.transaction import Transaction
from app.ml.name_suggester import CanonicalNameSuggester


def test_name_suggester_trains_and_suggests(seeded_db):
    suggester = CanonicalNameSuggester()
    for _ in range(12):
        suggester.record_example(
            seeded_db,
            input_description="AMZN Mktp DE*1234 800-279-6620 LU",
            input_merchant="AMZN Mktp",
            target_merchant="AMAZON",
            target_description="Amazon Marketplace",
        )
    seeded_db.commit()
    metrics = suggester.retrain(seeded_db)
    assert metrics["status"] == "trained"

    hint = suggester.suggest(
        "AMZN Mktp DE*9988 800-279-6620 LU",
        "AMZN Mktp",
    )
    assert hint["suggested_merchant"] == "AMAZON"
    assert (hint["merchant_confidence"] or 0.0) > 0.0


def test_name_suggester_bootstraps_from_existing_classified_transactions(seeded_db):
    for idx in range(12):
        seeded_db.add(
            Transaction(
                account_id=1,
                import_batch_id=None,
                date=date(2026, 6, 1),
                amount=-10.0 - idx,
                raw_description=f"AMZN Mktp DE*BOOT{idx} 800-279-6620 LU",
                description="Amazon Marketplace",
                merchant="AMAZON",
                currency="EUR",
                dedup_hash=f"unit-test-bootstrap-{idx}",
                final_category_id=1,
                classification_source="human",
                confidence=1.0,
            )
        )
    seeded_db.commit()

    suggester = CanonicalNameSuggester()
    metrics = suggester.retrain(seeded_db)
    assert metrics["status"] == "trained"
    assert metrics["num_examples"] >= 10
