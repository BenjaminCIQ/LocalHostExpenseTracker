from datetime import date

from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.events.bus import TransactionClassifiedEvent
from app.events.consumers.soft_suggestion_updater import handle_transaction_classified
from app.models.category import Category
from app.models.transaction import Transaction


def test_similar_endpoint_returns_candidates(client, db_session, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200

    seed = db_session.query(Transaction).filter(Transaction.merchant == "REWE").first()
    assert seed is not None

    extra = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 1, 6),
        amount=-12.34,
        raw_description="POS 9999 REWE SAGT DANKE//KOELN/DE",
        description="POS 9999 REWE SAGT DANKE//KOELN/DE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="api-test-rewe-2",
    )
    db_session.add(extra)
    db_session.commit()

    similar = client.get(f"/api/transactions/{seed.id}/similar?min_score=0&limit=10")
    assert similar.status_code == 200
    data = similar.json()
    assert any(c["transaction_id"] == extra.id for c in data)


def test_bulk_classify_endpoint_classifies_all_selected(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200

    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)

    txns = client.get("/api/transactions/?classified=false").json()["items"]
    ids = [t["id"] for t in txns]
    assert len(ids) >= 2

    bulk = client.post(
        "/api/transactions/bulk-classify",
        json={"transaction_ids": ids[:2], "category_id": cat_id},
    )
    assert bulk.status_code == 200
    body = bulk.json()
    assert body["updated"] == 2
    assert body["skipped"] == 0

    classified = client.get("/api/transactions/?classified=true").json()
    assert classified["total"] >= 2


def test_soft_suggestion_consumer_populates_predictions(db_engine, seeded_db):
    category_ids = [c.id for c in seeded_db.query(Category).limit(3).all()]
    assert len(category_ids) >= 3
    seed_category_id = category_ids[0]
    suggested_category_id = category_ids[1]
    existing_prediction_category_id = category_ids[2]

    # Create a seed + two candidates with same merchant.
    seed = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 1, 2),
        amount=-10.0,
        raw_description="POS 1111 REWE SAGT DANKE//KOELN/DE",
        description="POS 1111 REWE SAGT DANKE//KOELN/DE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="consumer-seed-1",
        final_category_id=seed_category_id,
        classification_source="human",
        confidence=1.0,
    )
    c1 = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 1, 3),
        amount=-11.0,
        raw_description="POS 2222 REWE SAGT DANKE//KOELN/DE",
        description="POS 2222 REWE SAGT DANKE//KOELN/DE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="consumer-c1-1",
        final_category_id=None,
    )
    c2 = Transaction(
        account_id=1,
        import_batch_id=None,
        date=date(2026, 1, 4),
        amount=-12.0,
        raw_description="POS 3333 REWE SAGT DANKE//KOELN/DE",
        description="POS 3333 REWE SAGT DANKE//KOELN/DE",
        merchant="REWE",
        currency="EUR",
        dedup_hash="consumer-c2-1",
        final_category_id=None,
        predicted_category_id=existing_prediction_category_id,
        confidence=1.0,
    )
    seeded_db.add_all([seed, c1, c2])
    seeded_db.commit()

    old_min_score = settings.soft_similarity_min_score
    old_limit = settings.soft_similarity_limit
    settings.soft_similarity_min_score = 0
    settings.soft_similarity_limit = 25
    try:
        engine = db_engine
        SessionMaker = sessionmaker(bind=engine, autocommit=False, autoflush=False)

        def session_factory():
            return SessionMaker()

        event = TransactionClassifiedEvent(
            data={"transaction_id": seed.id, "category_id": suggested_category_id}
        )
        handle_transaction_classified(event, session_factory=session_factory)

        seeded_db.expire_all()
        refreshed = seeded_db.get(Transaction, c1.id)
        assert refreshed is not None
        assert refreshed.predicted_category_id == suggested_category_id
        assert refreshed.confidence is not None

        refreshed2 = seeded_db.get(Transaction, c2.id)
        assert refreshed2 is not None
        assert refreshed2.predicted_category_id == existing_prediction_category_id
        assert refreshed2.confidence == 1.0
    finally:
        settings.soft_similarity_min_score = old_min_score
        settings.soft_similarity_limit = old_limit

