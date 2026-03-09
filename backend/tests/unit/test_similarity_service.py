from datetime import date

from app.services.similarity_service import (
    find_similar,
    find_similar_unclassified,
    learn_merchant_alias,
)
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


def test_similarity_service_matches_merchant_variants(seeded_db):
    seed = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 3, 1),
        amount=-24.5,
        raw_description="KLINIKUM IM FRIEDRICHSHAIN KARTENZAHLUNG",
        description="KLINIKUM IM FRIEDRICHSHAIN KARTENZAHLUNG",
        merchant="KLINIKUM IM FRIEDRICHSHAIN",
        currency="EUR",
        dedup_hash="unit-test-merchant-variant-seed",
        final_category_id=1,
        classification_source="human",
        confidence=1.0,
    )

    candidate = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 3, 3),
        amount=-24.49,
        raw_description="KLINIKUM IM FRIEDRICHSHAIN KARTENZAHLUNG",
        description="KLINIKUM IM FRIEDRICHSHAIN KARTENZAHLUNG",
        merchant="KLINIKUM FRIEDRICHSHAIN",
        currency="EUR",
        dedup_hash="unit-test-merchant-variant-candidate",
        predicted_category_id=None,
        final_category_id=None,
        classification_source=None,
        confidence=None,
    )
    seeded_db.add_all([seed, candidate])
    seeded_db.commit()

    results = find_similar_unclassified(seeded_db, seed.id, limit=10, min_score=55)
    ids = [r.transaction_id for r in results]
    assert candidate.id in ids


def test_similarity_service_uses_learned_alias(seeded_db):
    seed = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 4, 1),
        amount=-18.0,
        raw_description="CARD PAYMENT VICTOR GOLLANCZ",
        description="CARD PAYMENT VICTOR GOLLANCZ",
        merchant="VICTOR GOLLANCZ VOLKSHOCHSCHULE",
        currency="EUR",
        dedup_hash="unit-test-alias-seed",
        final_category_id=1,
        classification_source="human",
        confidence=1.0,
    )
    candidate = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 4, 4),
        amount=-18.02,
        raw_description="CARD PAYMENT VHS VICTOR GOLLANCZ SCHULE",
        description="CARD PAYMENT VHS VICTOR GOLLANCZ SCHULE",
        merchant="VHS VICTOR GOLLANCZ",
        currency="EUR",
        dedup_hash="unit-test-alias-candidate",
        predicted_category_id=None,
        final_category_id=None,
        classification_source=None,
        confidence=None,
    )
    seeded_db.add_all([seed, candidate])
    seeded_db.commit()
    learn_merchant_alias(
        seeded_db,
        "VHS VICTOR GOLLANCZ",
        "VICTOR GOLLANCZ VOLKSHOCHSCHULE",
    )
    seeded_db.commit()

    results = find_similar(
        seeded_db,
        seed.id,
        limit=10,
        min_score=50,
        only_unclassified=False,
    )
    matched = next((r for r in results if r.transaction_id == candidate.id), None)
    assert matched is not None
    assert "canonical_merchant_match" in matched.reasons


def test_similarity_service_amzn_seed_merchant_amazon_matches_tokens(seeded_db):
    seed = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 5, 1),
        amount=-43.12,
        raw_description="AMZN Mktp DE*RC0QQ4DZ4 800-279-6620 LU",
        description="AMZN Mktp order RC0QQ4DZ4",
        merchant="AMAZON",
        currency="EUR",
        dedup_hash="unit-test-amzn-seed",
        final_category_id=1,
        classification_source="human",
        confidence=1.0,
    )
    candidate = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 5, 4),
        amount=-43.10,
        raw_description="AMZN Mktp DE*7Y6QQ4DZ4 800-279-6620 LU",
        description="AMZN Mktp order 7Y6QQ4DZ4",
        merchant="",
        currency="EUR",
        dedup_hash="unit-test-amzn-candidate",
        predicted_category_id=None,
        final_category_id=None,
        classification_source=None,
        confidence=None,
    )
    seeded_db.add_all([seed, candidate])
    seeded_db.commit()

    results = find_similar(
        seeded_db,
        seed.id,
        limit=10,
        min_score=50,
        only_unclassified=False,
    )
    ids = [r.transaction_id for r in results]
    assert candidate.id in ids

