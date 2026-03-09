from datetime import date

from app.services.similarity_service import find_similar_unclassified
from app.models.transaction import Transaction


def test_similarity_service_finds_same_merchant_unclassified(seeded_db):
    seed = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 1, 4),
        amount=-9.99,
        raw_description="POS 1234 REWE SAGT DANKE//KOELN/DE",
        description="POS 1234 REWE SAGT DANKE//KOELN/DE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="unit-test-rewe-seed",
        final_category_id=1,
        classification_source="human",
        confidence=1.0,
    )

    extra = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 1, 5),
        amount=-10.0,
        raw_description="POS 5555 REWE SAGT DANKE//KOELN/DE",
        description="POS 5555 REWE SAGT DANKE//KOELN/DE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="unit-test-rewe-2",
        predicted_category_id=None,
        final_category_id=None,
        classification_source=None,
        confidence=None,
    )
    seeded_db.add_all([seed, extra])
    seeded_db.commit()

    results = find_similar_unclassified(seeded_db, seed.id, limit=10, min_score=0)
    ids = [r.transaction_id for r in results]
    assert extra.id in ids


def test_similarity_service_operator_pool_matches_raw_text(seeded_db):
    seed = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 2, 1),
        amount=-12.34,
        raw_description="PAYPAL *ACME STORE 12345",
        description="PAYPAL *ACME STORE 12345",
        merchant="PAYPAL",
        currency="EUR",
        dedup_hash="unit-test-paypal-seed",
        final_category_id=1,
        classification_source="human",
        confidence=1.0,
    )

    candidate = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 2, 2),
        amount=-12.34,
        raw_description="PayPal *ACME Store 67890",
        description="PayPal *ACME Store 67890",
        merchant="(imported) unknown",
        currency="EUR",
        dedup_hash="unit-test-paypal-candidate",
        predicted_category_id=None,
        final_category_id=None,
        classification_source=None,
        confidence=None,
    )

    seeded_db.add_all([seed, candidate])
    seeded_db.commit()

    results = find_similar_unclassified(seeded_db, seed.id, limit=10, min_score=50)
    ids = [r.transaction_id for r in results]
    assert candidate.id in ids

