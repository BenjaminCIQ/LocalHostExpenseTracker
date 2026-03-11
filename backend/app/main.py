import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.deps import require_authenticated_user
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
    admin,
    analytics,
    accounts,
    auth,
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
    transfer_linking_rules,
    trips,
    transactions,
    upload,
)
from app.seed import seed_categories, seed_default_account, seed_default_person

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _parse_origins(raw_origins: str) -> list[str]:
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


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
        if "is_deleted" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN is_deleted BOOLEAN DEFAULT 0"))
        if "deleted_at" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN deleted_at DATETIME"))
        if "deleted_by_person_id" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN deleted_by_person_id INTEGER"))
        if "delete_reason" not in existing:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN delete_reason TEXT"))
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


def _ensure_people_admin_column():
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(persons)")).fetchall()
        existing = {r[1] for r in cols}
        if "is_admin" not in existing:
            conn.execute(text("ALTER TABLE persons ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
        if "icon_id" not in existing:
            conn.execute(text("ALTER TABLE persons ADD COLUMN icon_id VARCHAR(32)"))


def _ensure_account_icon_column():
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(accounts)")).fetchall()
        existing = {r[1] for r in cols}
        if "icon_id" not in existing:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN icon_id VARCHAR(32)"))


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


def _ensure_auth_tables():
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS person_credentials ("
                "id INTEGER PRIMARY KEY, "
                "person_id INTEGER NOT NULL UNIQUE, "
                "password_hash TEXT NOT NULL, "
                "password_salt TEXT NOT NULL, "
                "password_iterations INTEGER NOT NULL, "
                "failed_login_attempts INTEGER DEFAULT 0, "
                "last_failed_login_at DATETIME NULL, "
                "lockout_until DATETIME NULL, "
                "created_at DATETIME, "
                "updated_at DATETIME"
                ")"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS auth_sessions ("
                "id INTEGER PRIMARY KEY, "
                "person_id INTEGER NOT NULL, "
                "token_hash VARCHAR(64) NOT NULL UNIQUE, "
                "user_agent TEXT DEFAULT '', "
                "ip_address VARCHAR(64) DEFAULT '', "
                "expires_at DATETIME NOT NULL, "
                "created_at DATETIME, "
                "last_seen_at DATETIME, "
                "revoked_at DATETIME NULL"
                ")"
            )
        )
        cred_cols = conn.execute(text("PRAGMA table_info(person_credentials)")).fetchall()
        cred_existing = {r[1] for r in cred_cols}
        if "failed_login_attempts" not in cred_existing:
            conn.execute(text("ALTER TABLE person_credentials ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
        if "last_failed_login_at" not in cred_existing:
            conn.execute(text("ALTER TABLE person_credentials ADD COLUMN last_failed_login_at DATETIME NULL"))
        if "lockout_until" not in cred_existing:
            conn.execute(text("ALTER TABLE person_credentials ADD COLUMN lockout_until DATETIME NULL"))
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS security_events ("
                "id INTEGER PRIMARY KEY, "
                "person_id INTEGER NULL, "
                "event_type VARCHAR(50) NOT NULL, "
                "severity VARCHAR(20) DEFAULT 'info', "
                "message TEXT DEFAULT '', "
                "ip_address VARCHAR(64) DEFAULT '', "
                "user_agent TEXT DEFAULT '', "
                "metadata_json TEXT NULL, "
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
    _ensure_people_admin_column()
    _ensure_account_icon_column()
    _ensure_external_tracking_tables()
    _ensure_auth_tables()

    db = SessionLocal()
    try:
        seed_default_person(db)
        seed_categories(db)
        seed_default_account(db)
        ben = db.execute(text("SELECT id FROM persons WHERE lower(name)='ben' LIMIT 1")).fetchone()
        if ben:
            db.execute(text("UPDATE persons SET is_admin=1 WHERE id=:id"), {"id": ben[0]})
            db.commit()
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
    allow_origins=_parse_origins(settings.cors_allowed_origins),
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(accounts.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(categories.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(import_profiles.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(parsing_rules.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(persons.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(upload.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(transactions.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(external_accounts.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(dashboard.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(analytics.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(budgets.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(ml.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(overrides.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(rules.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(suggestions.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(transfer_linking_rules.router, dependencies=[Depends(require_authenticated_user)])
app.include_router(trips.router, dependencies=[Depends(require_authenticated_user)])


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "true").lower() == "true",
    )
