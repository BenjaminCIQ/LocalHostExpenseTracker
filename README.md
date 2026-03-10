# Personal Expense Tracker

A local-first personal expense tracking system with progressive ML-powered automation. Upload bank statements, classify transactions manually, and watch the system learn to suggest categories with increasing accuracy over time.

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

1. **Upload**: Go to the Upload page and drop a CSV bank statement
2. **Classify**: Switch to Transactions, manually assign categories to each transaction
3. **Learn**: After 30+ classifications, the ML model trains automatically and starts suggesting categories
4. **Improve**: Corrections and new classifications continuously improve the model

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
