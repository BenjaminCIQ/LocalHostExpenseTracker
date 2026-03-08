import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.events.bus import event_bus
from app.events.consumers.merchant_memory_updater import (
    handle_transaction_classified as merchant_handler,
)
from app.events.consumers.ml_dataset_updater import (
    handle_transaction_classified as ml_handler,
)
from app.events.consumers.soft_suggestion_updater import (
    handle_transaction_classified as soft_similarity_handler,
)
from app.routers import (
    accounts,
    categories,
    dashboard,
    import_profiles,
    ml,
    overrides,
    rules,
    suggestions,
    transactions,
    upload,
)
from app.seed import seed_categories, seed_default_account

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _ensure_transactions_raw_columns():
    # SQLite doesn't support ALTER COLUMN; we add missing columns safely.
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(transactions)")).fetchall()
        existing = {r[1] for r in cols}

        if "raw_row_json" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN raw_row_json TEXT"))
        if "raw_row_line" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN raw_row_line TEXT"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    for d in [settings.data_dir, settings.ml_model_dir, settings.upload_dir]:
        Path(d).mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)

    _ensure_transactions_raw_columns()

    db = SessionLocal()
    try:
        seed_categories(db)
        seed_default_account(db)
    finally:
        db.close()

    event_bus.subscribe("transaction_classified", ml_handler)
    event_bus.subscribe("transaction_classified", merchant_handler)
    event_bus.subscribe("transaction_classified", soft_similarity_handler)

    logger.info("Expense Tracker backend started")
    yield
    logger.info("Expense Tracker backend shutting down")


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(import_profiles.router)
app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(ml.router)
app.include_router(overrides.router)
app.include_router(rules.router)
app.include_router(suggestions.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
