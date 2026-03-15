import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_pipeline
from app.models.account import Account
from app.pipeline.pipeline import ClassificationPipeline
from app.schemas.transaction import ImportResult
from app.services.classification_service import run_pipeline_on_import_batch
from app.services.ingestion_service import ingest_file
from app.services.transfer_reconciliation_service import apply_transfer_linking_rules

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Project docs folder (backend/app/routers -> project root)
_DOCS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "docs"
EXAMPLE_CSV_FILES = {
    "main": "example_MainAcc_mt940.csv",
    "savings": "example_savings.csv",
}

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

    # Apply transfer linking rules (auto-link when exactly one rule matches).
    apply_transfer_linking_rules(db, person_id=None)

    return ImportResult(
        batch_id=batch.id,
        filename=batch.filename,
        transactions_imported=batch.transaction_count,
        duplicates_skipped=batch.duplicates_skipped,
        account_id=account_id,
        potential_duplicates=getattr(batch, "_potential_duplicates", []),
        duplicate_overrides_applied=getattr(batch, "_duplicate_overrides_applied", 0),
    )


@router.get("/example-csv", response_class=PlainTextResponse)
async def get_example_csv(
    file: str = Query(..., description="Which sample: 'main' or 'savings'"),
):
    """Return a sample CSV for the tour. Used by the frontend to upload without file picker."""
    if file not in EXAMPLE_CSV_FILES:
        raise HTTPException(status_code=400, detail="file must be 'main' or 'savings'")
    path = _DOCS_DIR / EXAMPLE_CSV_FILES[file]
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Example file not found")
    return PlainTextResponse(
        path.read_text(encoding="utf-8"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{EXAMPLE_CSV_FILES[file]}"'},
    )
