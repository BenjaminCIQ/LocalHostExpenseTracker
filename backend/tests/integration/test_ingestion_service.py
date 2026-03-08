import pytest

from app.models.transaction import Transaction
from app.services.ingestion_service import ingest_file


def test_ingests_csv_and_creates_transactions(seeded_db, sample_csv: str):
    batch = ingest_file(
        seeded_db,
        file_content=sample_csv,
        filename="export.csv",
        account_id=1,
    )
    assert batch.transaction_count == 3
    assert batch.duplicates_skipped == 0

    txns = seeded_db.query(Transaction).all()
    assert len(txns) == 3
    assert any(t.amount < 0 for t in txns)
    assert any(t.amount > 0 for t in txns)


def test_deduplication_skips_duplicates(seeded_db, sample_csv: str):
    batch1 = ingest_file(seeded_db, sample_csv, "export.csv", account_id=1)
    batch2 = ingest_file(seeded_db, sample_csv, "export.csv", account_id=1)

    assert batch1.transaction_count == 3
    assert batch2.transaction_count == 0
    assert batch2.duplicates_skipped == 3

    txns = seeded_db.query(Transaction).all()
    assert len(txns) == 3


def test_unsupported_format_raises(seeded_db):
    with pytest.raises(ValueError):
        ingest_file(seeded_db, "x", "statement.txt", account_id=1)

