from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.schemas.transaction import ImportResult
from app.services.ingestion_service import ingest_file

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/", response_model=ImportResult)
async def upload_bank_statement(
    file: UploadFile = File(...),
    account_id: int = Query(..., description="Account to import into"),
    db: Session = Depends(get_db),
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

    try:
        batch = ingest_file(db, content, file.filename or "unknown.csv", account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ImportResult(
        batch_id=batch.id,
        filename=batch.filename,
        transactions_imported=batch.transaction_count,
        duplicates_skipped=batch.duplicates_skipped,
        account_id=account_id,
    )
