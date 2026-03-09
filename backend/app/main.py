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
    analytics,
    accounts,
    budgets,
    categories,
    dashboard,
    external_accounts,
    import_profiles,
    ml,
    overrides,
    parsing_rules,
    persons,
    rules,
    suggestions,
    trips,
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
        if "transaction_kind" not in existing:
            conn.execute(
                text("ALTER TABLE transactions ADD COLUMN transaction_kind VARCHAR(20) DEFAULT 'expense'")
            )
        if "transfer_group_id" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN transfer_group_id VARCHAR(64)"))
        if "transfer_linked_transaction_id" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN transfer_linked_transaction_id INTEGER"))
        if "transfer_confidence" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN transfer_confidence FLOAT"))
        if "transfer_match_source" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN transfer_match_source VARCHAR(20)"))
        if "is_internal_transfer" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN is_internal_transfer BOOLEAN DEFAULT 0"))
        conn.execute(
            text(
                "UPDATE transactions "
                "SET transaction_kind = CASE "
                "WHEN amount > 0 THEN 'income' "
                "WHEN amount < 0 THEN 'expense' "
                "ELSE 'adjustment' END "
                "WHERE transaction_kind IS NULL OR transaction_kind = ''"
            )
        )


def _ensure_accounts_person_column():
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(accounts)")).fetchall()
        existing = {r[1] for r in cols}
        if "person_id" not in existing:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN person_id INTEGER"))
        if "starting_balance" not in existing:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN starting_balance FLOAT DEFAULT 0.0"))
        if "account_group" not in existing:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN account_group VARCHAR(30) DEFAULT 'cash'"))


def _ensure_external_tracking_tables():
    # Safe table creation for SQLite deployments that pre-date external tracking.
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS external_accounts ("
                "id INTEGER PRIMARY KEY, "
                "name VARCHAR(120) NOT NULL, "
                "account_type VARCHAR(40) DEFAULT 'investment', "
                "account_group VARCHAR(20) DEFAULT 'asset', "
                "currency VARCHAR(3) DEFAULT 'EUR', "
                "owner VARCHAR(100) DEFAULT '', "
                "person_id INTEGER NULL, "
                "notes TEXT DEFAULT '', "
                "is_active BOOLEAN DEFAULT 1, "
                "ticker VARCHAR(32) NULL, "
                "asset_class VARCHAR(40) NULL, "
                "pricing_provider VARCHAR(40) NULL, "
                "last_price_sync_at DATETIME NULL, "
                "created_at DATETIME"
                ")"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS external_valuation_snapshots ("
                "id INTEGER PRIMARY KEY, "
                "external_account_id INTEGER NOT NULL, "
                "snapshot_date DATETIME NOT NULL, "
                "value FLOAT NOT NULL, "
                "source VARCHAR(20) DEFAULT 'manual', "
                "confidence FLOAT NULL, "
                "notes TEXT DEFAULT '', "
                "created_at DATETIME"
                ")"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS external_funding_links ("
                "id INTEGER PRIMARY KEY, "
                "external_account_id INTEGER NOT NULL, "
                "transaction_id INTEGER NOT NULL, "
                "linked_amount FLOAT NOT NULL, "
                "link_type VARCHAR(20) DEFAULT 'funding_in', "
                "notes TEXT DEFAULT '', "
                "created_at DATETIME"
                ")"
            )
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    for d in [settings.data_dir, settings.ml_model_dir, settings.upload_dir]:
        Path(d).mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)

    _ensure_transactions_raw_columns()
    _ensure_accounts_person_column()
    _ensure_external_tracking_tables()

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
app.include_router(parsing_rules.router)
app.include_router(persons.router)
app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(external_accounts.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(budgets.router)
app.include_router(ml.router)
app.include_router(overrides.router)
app.include_router(rules.router)
app.include_router(suggestions.router)
app.include_router(trips.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
