import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.events.bus import event_bus
from app.events.consumers.merchant_memory_updater import (
    handle_transaction_classified as merchant_handler,
)
from app.events.consumers.ml_dataset_updater import (
    handle_transaction_classified as ml_handler,
)
from app.routers import (
    accounts,
    categories,
    dashboard,
    ml,
    overrides,
    rules,
    transactions,
    upload,
)
from app.seed import seed_categories, seed_default_account

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    for d in [settings.data_dir, settings.ml_model_dir, settings.upload_dir]:
        Path(d).mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_categories(db)
        seed_default_account(db)
    finally:
        db.close()

    event_bus.subscribe("transaction_classified", ml_handler)
    event_bus.subscribe("transaction_classified", merchant_handler)

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
app.include_router(upload.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(ml.router)
app.include_router(overrides.router)
app.include_router(rules.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
