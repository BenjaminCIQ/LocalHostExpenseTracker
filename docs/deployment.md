# Deployment

## Database hardening (access control)

Even without encryption, restrict who can read the database file:

- **Linux/macOS**: Run the app as a dedicated user. After the app has created `data/` at least once, run:
  ```bash
  backend/scripts/set_db_permissions.sh backend/data
  ```
  This sets `data/` to `700` and `*.db` (and WAL files) to `600` so only the app user can access them.
- **Windows**: Use a dedicated user account for the app and ensure only that user has access to the `data/` directory (folder properties → Security).

## Optional: SQLite encryption (SQLCipher)

To encrypt the database at rest, set `EXPENSE_TRACKER_DATABASE_PASSPHRASE` (key from env only; never in code or repo). See [Encrypt existing database](#encrypt-existing-database) to convert an existing plain DB.

- Install the optional dependency: `pip install sqlcipher3`
- Set the passphrase in your environment (e.g. `.env`) and restart the app. The app will use SQLCipher when the passphrase is set.
- **Backup**: Back up the `data/` directory and store the passphrase securely; without it, the database cannot be decrypted.

## Encrypt existing database

To convert an existing unencrypted SQLite database to SQLCipher:

1. Back up the current database: `cp backend/data/expense_tracker.db backend/data/expense_tracker.db.bak`
2. Run the migration script (see `backend/scripts/README.md` or run):
   ```bash
   cd backend && EXPENSE_TRACKER_DATABASE_PASSPHRASE=your-secret-key python -m scripts.encrypt_existing_db
   ```
3. Set `EXPENSE_TRACKER_DATABASE_PASSPHRASE` in your environment and restart the app.

## Backups

- Back up the entire `data/` directory (database, ML models, uploads).
- If using SQLCipher, store the passphrase in a secure place (e.g. password manager); without it, the backup cannot be restored.
- Example (cron): `0 2 * * * tar -czf /backups/expense-tracker-$(date +\%Y\%m\%d).tar.gz -C /path/to/app backend/data`

## HTTPS and cookies

When running behind HTTPS (e.g. reverse proxy), set:

- `EXPENSE_TRACKER_AUTH_COOKIE_SECURE=true`
- `EXPENSE_TRACKER_CORS_ALLOWED_ORIGINS=https://your-frontend-origin`

Do not use a wildcard for CORS when using credentials (cookies).

## Bare-metal run

1. Install Python 3.11+ and Node.js 18+.
2. Build the frontend once: `cd frontend && npm ci && npm run build`
3. Set env (e.g. copy `.env.example` to `.env` and set required values). Set `EXPENSE_TRACKER_STATIC_DIR` to the absolute path of `frontend/dist` so the backend serves the SPA.
4. Run the backend without reload: `cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` (omit `--reload` in production).
5. Optionally use a process manager (e.g. systemd) to keep the app running and restart on failure.
