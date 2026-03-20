# Personal Expense Tracker

A local-first personal expense tracking system with progressive ML-powered automation. Upload bank statements, classify transactions manually, and watch the system learn to suggest categories with increasing accuracy over time.

This project was built entirely through AI coding agents in my very limited free time to see if I could get something useful without having to invest significant time or effort. I found the process genuinely fascinating and pretty impressive. I'm sharing it publicly in the hope that others find it useful, either as a practical finance tool, or a small (and probably unimpressive) showcase of AI capabilities.

## Architecture

- **Backend**: Python + FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **ML Pipeline**: scikit-learn (TF-IDF + Logistic Regression)
- **Event System**: In-process observer pattern

See [expense_tracker_architecture.md](expense_tracker_architecture.md) for the full design document.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --reload --port 8000
```

The backend starts at http://localhost:8000. API docs at http://localhost:8000/docs.

On first run, the database is created automatically with:
- A default "Main Account"
- 54 default categories (11 top-level with subcategories)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at http://localhost:5173 and proxies API requests to the backend.

## Usage

1. **Upload**: Go to the Upload page and drop a CSV bank statement. The seeded import profile **"Docs demo (German CSV)"** matches the example files in `docs/` (`example_MainAcc_mt940.csv`, `example_savings.csv`) — select it when uploading those.
2. **Classify**: Switch to Transactions, manually assign categories to each transaction
3. **Learn**: After 30+ classifications, the ML model trains automatically and starts suggesting categories
4. **Improve**: Corrections and new classifications continuously improve the model

## Deployment

### Docker (recommended)

1. Copy env: `cp .env.example .env` and set at least `EXPENSE_TRACKER_AUTH_TOKEN_PEPPER` (required in production).
2. Build and run:
   ```bash
   docker compose up --build -d
   ```
   App is at http://localhost:8000 (frontend and API from one container). Data is stored in `backend/data/` (bind-mounted); back up this directory regularly.
3. Optional: use a reverse proxy (Caddy, nginx, Traefik) in front for HTTPS; then set `EXPENSE_TRACKER_AUTH_COOKIE_SECURE=true` and `EXPENSE_TRACKER_CORS_ALLOWED_ORIGINS` to your front-end origin.

### Bare metal

1. Build frontend: `cd frontend && npm ci && npm run build`
2. Set env (see `.env.example`). Set `EXPENSE_TRACKER_STATIC_DIR` to the absolute path of `frontend/dist`.
3. Run backend (no reload): `cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`

### Secrets and production

- **Required in production**: set `EXPENSE_TRACKER_AUTH_TOKEN_PEPPER` to a strong random value; set `EXPENSE_TRACKER_ENV=production` so the app refuses to start with the default pepper.
- **Optional SQLite encryption**: set `EXPENSE_TRACKER_DATABASE_PASSPHRASE` (key from env only). See [docs/deployment.md](docs/deployment.md) for encrypting an existing database and backups.
- Never commit `.env` or the contents of `backend/data/`; they are in `.gitignore`.

### Cookie and CORS

- When behind HTTPS, set `EXPENSE_TRACKER_AUTH_COOKIE_SECURE=true`.
- Set `EXPENSE_TRACKER_CORS_ALLOWED_ORIGINS` to your front-end origin(s), comma-separated. Do not use a wildcard when using credentials (cookies).

### Health and readiness

- `GET /api/health` — liveness.
- `GET /api/ready` — readiness (checks DB connectivity; use for orchestrators).

More detail (database hardening, backups, HTTPS): [docs/deployment.md](docs/deployment.md).

## Project Structure

```
backend/
  app/
    main.py              # FastAPI entry point
    config.py            # Settings
    database.py          # SQLAlchemy setup
    deps.py              # Dependency injection (classifier, pipeline)
    seed.py              # Default categories and account
    models/              # SQLAlchemy ORM models
    schemas/             # Pydantic request/response schemas
    routers/             # API endpoints
    services/            # Business logic
    pipeline/            # Classification pipeline framework
    parsers/             # Bank statement parsers (CSV, etc.)
    events/              # Event bus + consumers
    ml/                  # ML classifier, trainer, preprocessor
frontend/
  src/
    pages/               # Dashboard, Transactions, Upload, ML Status
    components/          # Layout, UI components
    lib/                 # API client, utilities
```
