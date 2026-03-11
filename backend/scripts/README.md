# Scripts

- **set_db_permissions.sh** — Restrict filesystem access to the database directory (Linux/macOS). Run from repo root: `backend/scripts/set_db_permissions.sh backend/data`.
- **encrypt_existing_db.py** — One-off migration of a plain SQLite database to SQLCipher. Set `EXPENSE_TRACKER_DATABASE_PASSPHRASE` in the environment, then from `backend/`: `python -m scripts.encrypt_existing_db`. See [docs/deployment.md](../../docs/deployment.md).
