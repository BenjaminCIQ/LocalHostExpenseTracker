from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    if settings.database_passphrase:
        try:
            import sqlcipher3
        except ImportError:
            raise ImportError(
                "SQLCipher requested (EXPENSE_TRACKER_DATABASE_PASSPHRASE set) but sqlcipher3 not installed. "
                "Run: pip install sqlcipher3"
            )
        # Derive absolute path from database_url (e.g. sqlite:///./data/expense_tracker.db)
        url_path = settings.database_url.replace("sqlite:///", "").lstrip("/")
        db_path = Path(url_path).resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        uri = "sqlite+pysqlcipher:///" + db_path.as_posix()
        engine = create_engine(
            uri,
            connect_args={"check_same_thread": False},
            echo=False,
            module=sqlcipher3,
        )

        passphrase = settings.database_passphrase
        # PRAGMA key does not support bound parameters; escape single quotes only
        key_escaped = passphrase.replace("'", "''")

        @event.listens_for(engine, "connect")
        def _set_sqlcipher_key(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute(f"PRAGMA key='{key_escaped}'")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    else:
        engine = create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            echo=False,
        )

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
