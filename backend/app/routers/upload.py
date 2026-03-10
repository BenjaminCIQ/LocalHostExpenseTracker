import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_pipeline
from app.models.account import Account
from app.pipeline.pipeline import ClassificationPipeline
from app.schemas.transaction import ImportResult
from app.services.classification_service import run_pipeline_on_import_batch
from app.services.ingestion_service import ingest_file

router = APIRouter(prefix="/api/upload", tags=["upload"])

@router.post("/", response_model=ImportResult)
async def upload_bank_statement(
    file: UploadFile = File(...),
    account_id: int = Query(..., description="Account to import into"),
    import_profile_id: int | None = Query(
        None, description="Optional import profile to use for parsing"
    ),
    duplicate_override_keys_json: str | None = Form(
        None,
        description="JSON array of duplicate keys explicitly approved by user",
    ),
    db: Session = Depends(get_db),
    pipeline: ClassificationPipeline = Depends(get_pipeline),
):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    content_bytes = await file.read()
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            content = content_bytes.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Unable to decode file. Supported encodings: UTF-8, Latin-1",
            )

    duplicate_override_keys: list[str] = []
    if duplicate_override_keys_json:
        try:
            parsed = json.loads(duplicate_override_keys_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="duplicate_override_keys_json must be valid JSON")
        if not isinstance(parsed, list):
            raise HTTPException(status_code=400, detail="duplicate_override_keys_json must be a JSON array")
        duplicate_override_keys = [str(x) for x in parsed if str(x).strip()]

    try:
        batch = ingest_file(
            db,
            content,
            file.filename or "unknown.csv",
            account_id,
            import_profile_id=import_profile_id,
            duplicate_override_keys=duplicate_override_keys,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Populate predictions immediately after ingestion so the UI can show
    # rule/override-based suggestions without requiring a manual re-run.
    run_pipeline_on_import_batch(db, batch.id, pipeline)

    return ImportResult(
        batch_id=batch.id,
        filename=batch.filename,
        transactions_imported=batch.transaction_count,
        duplicates_skipped=batch.duplicates_skipped,
        account_id=account_id,
        potential_duplicates=getattr(batch, "_potential_duplicates", []),
        duplicate_overrides_applied=getattr(batch, "_duplicate_overrides_applied", 0),
    )
