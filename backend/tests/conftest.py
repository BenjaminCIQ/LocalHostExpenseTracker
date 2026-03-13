import io
from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base
from app.deps import get_classifier as prod_get_classifier
from app.deps import get_pipeline as prod_get_pipeline
from app.database import get_db as prod_get_db
from app.ml.classifier import MLClassifier
from app.pipeline.ml_stage import MLClassifierStage
from app.pipeline.pipeline import ClassificationPipeline
from app.models import rule as _rule_models  # noqa: F401
from app.models import parsing_rule as _parsing_rule_models  # noqa: F401
from app.models import person as _person_models  # noqa: F401
from app.models.account import Account
from app.models.person import Person
from app.routers import (
    analytics,
    accounts,
    categories,
    dashboard,
    external_accounts,
    import_profiles,
    ml,
    overrides,
    parsing_rules,
    persons,
    rules,
    transactions,
    upload,
)
from app.seed import seed_categories


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(db_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def seeded_db(db_session: Session) -> Session:
    seed_categories(db_session)
    person = Person(name="Test User")
    db_session.add(person)
    db_session.flush()
    account = Account(
        name="Main Account",
        bank_name="",
        account_type="checking",
        currency="EUR",
        owner="",
        person_id=person.id,
    )
    db_session.add(account)
    db_session.commit()
    return db_session


@pytest.fixture()
def sample_csv() -> str:
    # Semicolon-delimited German format with comma decimals.
    return "\n".join(
        [
            "Some Bank Export",
            "Generated: 01.01.2026",
            "Datum;Betrag;Beschreibung;Auftraggeber/Empfänger",
            "02.01.2026;-42,50;POS 1234 REWE SAGT DANKE//KOELN/DE;REWE",
            "03.01.2026;-9,99;SEPA-LASTSCHRIFT Spotify AB 4829174;Spotify AB",
            "04.01.2026;2500,00;Gehalt Januar;Employer GmbH",
            "",
        ]
    )


@pytest.fixture()
def classifier(tmp_path) -> MLClassifier:
    # Ensure models are written to a temp dir during tests.
    settings.ml_model_dir = tmp_path / "ml_models"
    return MLClassifier()


@pytest.fixture()
def test_app(db_session: Session, classifier: MLClassifier) -> FastAPI:
    app = FastAPI(title="Expense Tracker Test App")

    def _get_db_override():
        yield db_session

    def _get_classifier_override():
        return classifier

    def _get_pipeline_override():
        return ClassificationPipeline(stages=[MLClassifierStage(classifier)])

    app.dependency_overrides[prod_get_db] = _get_db_override
    app.dependency_overrides[prod_get_classifier] = _get_classifier_override
    app.dependency_overrides[prod_get_pipeline] = _get_pipeline_override

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
    app.include_router(ml.router)
    app.include_router(overrides.router)
    app.include_router(rules.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


@pytest.fixture()
def client(test_app: FastAPI, seeded_db: Session) -> Generator[TestClient, None, None]:
    # Ensure seeded_db runs before client is created.
    with TestClient(test_app) as c:
        yield c

