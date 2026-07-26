# AI-Ready Customer Support Dashboard

A customer support dashboard with authentication, conversations, document metadata
upload, and search. Built with Next.js, FastAPI, and PostgreSQL.

> This README covers setup only for now. Full feature docs, API reference, and the
> database schema are added later in the project.

## Requirements

- Python 3.11+ (macOS ships 3.9 — install a newer one, e.g. `brew install python@3.12`)
- Node.js 18+
- PostgreSQL 14+ running locally

## Database setup

The app uses a local PostgreSQL server (no Docker required). Create the two databases —
one for the app, one for tests:

```bash
createdb ai_support
createdb ai_support_test
```

If your PostgreSQL uses a different superuser, add it: `createdb -U postgres ai_support`.

## Backend

```bash
cd backend
python3.12 -m venv .venv           # any Python >= 3.11
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

cp .env.example .env               # then edit DATABASE_URL to match your PostgreSQL user
alembic upgrade head               # create the tables
uvicorn app.main:app --reload
```

The API runs at http://localhost:8000 and interactive docs are at
http://localhost:8000/docs.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local        # optional — defaults to http://localhost:8000/api/v1
npm run dev
```

The app runs at http://localhost:3000. Start the backend first: the frontend reads
`NEXT_PUBLIC_API_URL` and calls it directly.

## Tests

```bash
cd backend
pytest
```

## Environment variables

All backend settings live in `backend/.env` — see `backend/.env.example` for the full
list and defaults. The most important one is `DATABASE_URL`, which must match your local
PostgreSQL user and password.

## Assumptions

Design decisions and scope choices are documented in [ASSUMPTIONS.md](ASSUMPTIONS.md).
