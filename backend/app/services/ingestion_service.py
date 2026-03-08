import hashlib
import logging

from sqlalchemy.orm import Session

from app.models.import_batch import ImportBatch
from app.models.transaction import Transaction
from app.parsers.base import ParsedTransaction
from app.parsers.format_detector import detect_parser

logger = logging.getLogger(__name__)


def compute_dedup_hash(
    account_id: int, date_str: str, amount: float, raw_description: str
) -> str:
    key = f"{account_id}|{date_str}|{amount:.2f}|{raw_description}"
    return hashlib.sha256(key.encode()).hexdigest()


def ingest_file(
    db: Session,
    file_content: str,
    filename: str,
    account_id: int,
) -> ImportBatch:
    """Parse a bank export file and insert deduplicated transactions."""
    parser = detect_parser(file_content, filename)
    if parser is None:
        raise ValueError(
            f"No parser available for '{filename}'. "
            f"Supported formats: CSV"
        )

    parsed = parser.parse(file_content, filename)
    batch = ImportBatch(
        account_id=account_id,
        filename=filename,
        file_format=parser.format_name,
    )
    db.add(batch)
    db.flush()

    imported = 0
    skipped = 0

    for p in parsed:
        dedup = compute_dedup_hash(
            account_id, str(p.date), p.amount, p.raw_description
        )
        exists = (
            db.query(Transaction.id)
            .filter(Transaction.dedup_hash == dedup)
            .first()
        )
        if exists:
            skipped += 1
            continue

        txn = Transaction(
            account_id=account_id,
            import_batch_id=batch.id,
            date=p.date,
            amount=p.amount,
            raw_description=p.raw_description,
            description=p.description,
            merchant=p.merchant,
            currency=p.currency,
            dedup_hash=dedup,
        )
        db.add(txn)
        imported += 1

    batch.transaction_count = imported
    batch.duplicates_skipped = skipped
    db.commit()

    logger.info(
        "Imported %d transactions (%d duplicates skipped) from %s",
        imported,
        skipped,
        filename,
    )
    return batch
