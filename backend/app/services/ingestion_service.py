import hashlib
import logging
import re

from sqlalchemy.orm import Session

from app.models.import_batch import ImportBatch
from app.models.import_profile import ImportProfile
from app.models.parsing_rule import ParsingRule
from app.models.transaction import Transaction
from app.parsers.base import ParsedTransaction
from app.parsers.csv_parser import CSVBankParser
from app.parsers.format_detector import detect_parser
from app.schemas.import_profile import json_to_columns
from app.services.duplicate_detection_service import (
    find_potential_duplicate_for_parsed,
    store_duplicate_overrides,
)
from app.services.payment_operator import detect_payment_operator

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
    import_profile_id: int | None = None,
    duplicate_override_keys: list[str] | None = None,
) -> ImportBatch:
    """Parse a bank export file and insert deduplicated transactions."""
    parser = detect_parser(file_content, filename)
    if parser is None:
        raise ValueError(
            f"No parser available for '{filename}'. "
            f"Supported formats: CSV"
        )

    import_profile: ImportProfile | None = None
    if import_profile_id is not None:
        import_profile = db.get(ImportProfile, import_profile_id)
        if import_profile is None:
            raise ValueError("Import profile not found")
        if not import_profile.enabled:
            raise ValueError("Import profile is disabled")

    if import_profile is not None and isinstance(parser, CSVBankParser):
        parsed = parser.parse_with_profile(
            file_content,
            filename,
            delimiter=import_profile.delimiter,
            date_column=import_profile.date_column,
            amount_column=import_profile.amount_column,
            currency_column=import_profile.currency_column,
            merchant_columns=json_to_columns(import_profile.merchant_columns_json),
            description_columns=json_to_columns(import_profile.description_columns_json),
        )
    else:
        parsed = parser.parse(file_content, filename)

    # Apply enabled parsing rules (merchant normalization) before insert.
    rules_q = db.query(ParsingRule).filter(ParsingRule.enabled.is_(True))
    rules_q = rules_q.filter(
        (ParsingRule.import_profile_id.is_(None))
        | (ParsingRule.import_profile_id == import_profile_id)
    )
    rules = rules_q.order_by(ParsingRule.priority.asc(), ParsingRule.id.asc()).all()

    compiled_rules: list[tuple[ParsingRule, re.Pattern[str]]] = []
    for r in rules:
        try:
            compiled_rules.append((r, re.compile(r.match_regex, flags=re.IGNORECASE)))
        except re.error:
            continue

    if compiled_rules:
        for p in parsed:
            source_text = p.raw_description or p.description or p.raw_row_line or ""
            op = detect_payment_operator(p.merchant, source_text)
            for r, pat in compiled_rules:
                if r.operator_token and op and r.operator_token.upper() != op:
                    continue
                m = pat.search(source_text)
                if not m:
                    continue
                try:
                    extracted = m.group(r.merchant_group).strip()
                except Exception:
                    extracted = ""
                if extracted:
                    p.merchant = extracted[:200]
                break

    batch = ImportBatch(
        account_id=account_id,
        filename=filename,
        file_format=parser.format_name,
    )
    db.add(batch)
    db.flush()

    imported = 0
    skipped = 0
    potential_duplicates: list[dict] = []
    overrides_applied = 0
    if duplicate_override_keys:
        overrides_applied = store_duplicate_overrides(
            db,
            account_id=account_id,
            duplicate_keys=duplicate_override_keys,
        )
        if overrides_applied:
            db.flush()
    seen_dedup_hashes: set[str] = set()

    for p in parsed:
        dedup = compute_dedup_hash(
            account_id, str(p.date), p.amount, p.raw_description
        )
        # Avoid UNIQUE constraint failures when the input file itself contains duplicates.
        # (Our DB query below won't see unflushed pending inserts in this same session.)
        if dedup in seen_dedup_hashes:
            skipped += 1
            continue
        seen_dedup_hashes.add(dedup)
        exists = (
            db.query(Transaction.id)
            .filter(Transaction.dedup_hash == dedup)
            .first()
        )
        if exists:
            skipped += 1
            continue

        potential_dup = find_potential_duplicate_for_parsed(db, account_id, p)
        if potential_dup is not None:
            skipped += 1
            potential_duplicates.append(
                {
                    "duplicate_key": potential_dup.duplicate_key,
                    "rating": potential_dup.rating,
                    "reason": potential_dup.reason,
                    "existing_transaction_id": potential_dup.transaction_id,
                    "incoming_date": potential_dup.incoming_date,
                    "incoming_amount": potential_dup.incoming_amount,
                    "incoming_currency": potential_dup.incoming_currency,
                    "incoming_merchant": potential_dup.incoming_merchant,
                    "incoming_description": potential_dup.incoming_description,
                    "incoming_raw_description": potential_dup.incoming_raw_description,
                    "existing_date": potential_dup.existing_date,
                    "existing_amount": potential_dup.existing_amount,
                    "existing_currency": potential_dup.existing_currency,
                    "existing_merchant": potential_dup.existing_merchant,
                    "existing_description": potential_dup.existing_description,
                    "existing_raw_description": potential_dup.existing_raw_description,
                }
            )
            continue

        txn = Transaction(
            account_id=account_id,
            import_batch_id=batch.id,
            date=p.date,
            amount=p.amount,
            raw_description=p.raw_description,
            description=p.description,
            raw_row_json=p.raw_row_json,
            raw_row_line=p.raw_row_line,
            merchant=p.merchant,
            currency=p.currency,
            dedup_hash=dedup,
        )
        db.add(txn)
        imported += 1

    batch.transaction_count = imported
    batch.duplicates_skipped = skipped
    setattr(batch, "_potential_duplicates", potential_duplicates)
    setattr(batch, "_duplicate_overrides_applied", overrides_applied)
    db.commit()

    logger.info(
        "Imported %d transactions (%d duplicates skipped) from %s",
        imported,
        skipped,
        filename,
    )
    return batch
