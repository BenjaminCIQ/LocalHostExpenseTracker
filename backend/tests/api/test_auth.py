import pytest
from datetime import date
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import require_authenticated_user
from app.models.account import Account
from app.models.person import Person
from app.models.transaction import Transaction
from app.routers import admin, auth, transactions


def _build_app(db_session: Session) -> FastAPI:
    app = FastAPI(title="Auth Test App")

    def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(transactions.router)

    @app.get("/api/protected")
    def protected(_person=Depends(require_authenticated_user)):
        return {"ok": True}

    return app


def _seed_person(db_session: Session, name: str = "Alex") -> int:
    p = Person(name=name)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p.id


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_bootstrap_login_logout_and_protection(db_session: Session):
    person_id = _seed_person(db_session, "Casey")
    app = _build_app(db_session)
    with TestClient(app) as client:
        options = client.get("/api/auth/options")
        assert options.status_code == 200
        persons = options.json()["persons"]
        assert persons[0]["requires_password_setup"] is True

        before = client.get("/api/protected")
        assert before.status_code == 401

        boot = client.post(
            "/api/auth/bootstrap",
            json={"person_id": person_id, "password": "supersecret", "remember_me": True},
        )
        assert boot.status_code == 200
        assert boot.json()["authenticated"] is True

        after_bootstrap = client.get("/api/protected")
        assert after_bootstrap.status_code == 200

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200
        assert logout.json()["authenticated"] is False

        after_logout = client.get("/api/protected")
        assert after_logout.status_code == 401

        bad_login = client.post(
            "/api/auth/login",
            json={"person_id": person_id, "password": "bad-password"},
        )
        assert bad_login.status_code == 401

        good_login = client.post(
            "/api/auth/login",
            json={"person_id": person_id, "password": "supersecret", "remember_me": False},
        )
        assert good_login.status_code == 200
        me = client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["authenticated"] is True


def test_login_lockout_after_repeated_failures(db_session: Session):
    person_id = _seed_person(db_session, "LockMe")
    app = _build_app(db_session)
    with TestClient(app) as client:
        boot = client.post(
            "/api/auth/bootstrap",
            json={"person_id": person_id, "password": "supersecret", "remember_me": False},
        )
        assert boot.status_code == 200
        client.post("/api/auth/logout")

        for _ in range(5):
            bad = client.post(
                "/api/auth/login",
                json={"person_id": person_id, "password": "wrong"},
            )
            assert bad.status_code == 401

        blocked = client.post(
            "/api/auth/login",
            json={"person_id": person_id, "password": "wrong"},
        )
        assert blocked.status_code == 429


def test_admin_access_and_soft_delete_flow(db_session: Session):
    admin_person = Person(name="Ben", is_admin=True)
    user_person = Person(name="User", is_admin=False)
    db_session.add(admin_person)
    db_session.add(user_person)
    db_session.commit()
    db_session.refresh(admin_person)
    db_session.refresh(user_person)

    account = Account(name="Checking", currency="EUR")
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    txn = Transaction(
        account_id=account.id,
        date=date(2026, 2, 1),
        amount=-10.0,
        raw_description="test",
        description="test",
        merchant="Test",
        currency="EUR",
        dedup_hash="admin-soft-delete-test",
    )
    db_session.add(txn)
    db_session.commit()
    db_session.refresh(txn)

    app = _build_app(db_session)
    with TestClient(app) as client:
        client.post("/api/auth/bootstrap", json={"person_id": user_person.id, "password": "password123"})
        forbidden = client.get("/api/admin/persons")
        assert forbidden.status_code == 403
        client.post("/api/auth/logout")

        client.post("/api/auth/bootstrap", json={"person_id": admin_person.id, "password": "password123"})
        ok = client.get("/api/admin/persons")
        assert ok.status_code == 200

        deleted = client.post(
            f"/api/admin/transactions/{txn.id}/soft-delete",
            json={"reason": "duplicate"},
        )
        assert deleted.status_code == 200

        normal_list = client.get("/api/transactions/")
        assert normal_list.status_code == 200
        ids = [item["id"] for item in normal_list.json()["items"]]
        assert txn.id not in ids

        deleted_list = client.get("/api/admin/transactions/deleted")
        assert deleted_list.status_code == 200
        deleted_ids = [item["id"] for item in deleted_list.json()]
        assert txn.id in deleted_ids
