# AI-Ready Customer Support Dashboard

A customer support dashboard: email/password auth, multi-organisation support with instant
switching, conversation threads with search, document upload with metadata, and an activity
dashboard. Next.js 16 on the front, FastAPI + PostgreSQL behind it.

![Conversation detail](docs/screenshots/conversation-detail.png)

"AI-ready" is read as a requirement on the *data model*, not on behaviour — no LLM is
called anywhere. `messages.role` and `documents.status` exist so an AI layer could be
added later without a migration. That reasoning is in [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Video Walkthrough

👉 **[Watch the full walkthrough](https://your-video-link-here.com)** — registration, org
creation, conversation CRUD with search, document upload, org switching, and the dashboard,
all demonstrated end to end.

## Where to look first

If you have ten minutes, these five files carry most of the thinking:

| File | Why |
|---|---|
| [ENGINEERING_REPORT.md](ENGINEERING_REPORT.md) | Six engineering decisions, each with the alternatives that were rejected — including the multi-org transport choice |
| [backend/app/core/errors.py](backend/app/core/errors.py) | One error envelope, applied app-wide — every failure leaves as `{ detail, code }` |
| [backend/app/core/deps.py](backend/app/core/deps.py) | `get_active_org` dependency — reads `X-Org-ID`, verifies membership, returns the org row |
| [backend/tests/test_ownership.py](backend/tests/test_ownership.py) | Ownership is enforced twice and tested twice, deliberately — returns 404, never 403, for both cross-user and cross-org access |
| [frontend/src/lib/org-context.tsx](frontend/src/lib/org-context.tsx) | Active-org state: React context + localStorage + plain cookie for SSR |

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 16.2 (App Router), React 19.2, TypeScript 5 | Server Components by default; `"use client"` only where there is interaction |
| Styling | Tailwind CSS v4 | No component library — the UI primitives in `components/ui/` are hand-rolled |
| Data fetching | TanStack Query v5 | Client-side server state, caching, invalidation, and optimistic updates; conversation detail is seeded with server-fetched `initialData` |
| Forms | React Hook Form + Zod | The same Zod schemas type the form and validate it |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 | `asyncpg` driver; async all the way down |
| Database | PostgreSQL 14+ | Alembic owns every schema change |
| Auth | `bcrypt` + JWT in an `httpOnly` cookie | The token is deliberately absent from the login response body |
| Tests | pytest + pytest-asyncio + httpx; Playwright | 69 backend integration tests and 16 browser E2E tests |

## Features

**Auth** — register, log in, log out. The JWT is delivered only as an `httpOnly`,
`SameSite=Lax` cookie, so JavaScript cannot read it. Passwords are hashed with `bcrypt`.

**Organisations** — create an organisation on first login; the creator is automatically
added as admin. Switch between organisations from the topbar without logging out — every
view (dashboard, conversations, documents) updates instantly. Invite members via the API
(`POST /api/v1/organizations/{org_id}/members`). Every conversation and document belongs
to exactly one organisation and is invisible from any other.

**Dashboard** — conversation, message and document counts, plus the five most recent of
each, all scoped to the active organisation. One aggregated endpoint supplies all
dashboard-specific data; authentication and organisation membership are resolved
separately.

**Conversations** — create, rename inline, delete with confirmation, paginated list.
Search matches both conversation titles *and* message text, and returns each matching
conversation once. Input is debounced; wildcards are escaped, so searching `50%` finds
the literal string.

**Messages** — threaded view with a composer. Adding a message bumps the parent
conversation's `updated_at`, which is what the dashboard sorts by.

**Documents** — drag-and-drop or click-to-browse upload. PDF, DOCX and TXT only, 10 MB
maximum. The browser pre-checks type and size for fast feedback; the server validates
independently while streaming and never trusts the client.

**Throughout** — optimistic updates with rollback on failure, skeleton loading states,
error boundaries per route, a responsive layout with a hamburger drawer under 768px,
and keyboard-reachable controls with visible focus rings.

<details>
<summary>More screenshots</summary>

| Dashboard | Conversations |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Conversations](docs/screenshots/conversations.png) |

| Documents | Mobile drawer |
|---|---|
| ![Documents](docs/screenshots/documents.png) | ![Mobile navigation drawer](docs/screenshots/mobile-drawer.png) |

</details>

## Quick Start

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.11+ | `python3 --version` — macOS ships 3.9, which is too old; `brew install python@3.12` |
| Node.js | 20.9+ | `node --version` — Next.js 16 requires this, and fails to build below it |
| PostgreSQL | 14+, running | `pg_isready` — `brew services start postgresql@18` if it is not |

No Docker required.

### 1. Databases

```bash
createdb ai_support
createdb ai_support_test
```

If your PostgreSQL uses a different superuser, pass it: `createdb -U postgres ai_support`.

### 2. Backend — terminal 1

```bash
cd backend
python3.12 -m venv .venv            # any Python >= 3.11
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

cp .env.example .env                # then edit DATABASE_URL to match your PostgreSQL user
alembic upgrade head                # creates the tables
uvicorn app.main:app --reload
```

API at http://localhost:8000, Swagger UI at http://localhost:8000/docs.

> **Edit `DATABASE_URL` before running `alembic upgrade head`.** The default assumes a
> `postgres:postgres` login. Homebrew installs usually have no password, in which case
> `postgresql+asyncpg://$(whoami)@localhost:5432/ai_support` is what you want.

### 3. Frontend — terminal 2

```bash
cd frontend
npm ci
cp .env.example .env.local          # optional — defaults to http://localhost:8000/api/v1
npm run dev
```

App at http://localhost:3000. Signed out, it redirects to `/login`; follow "Create one" to
register, and you land on the dashboard. The backend must already be running — the browser
calls it directly.

### 4. Confirm it works

With the backend up, this should print `{"status":"ok"}`, then a user object, then an organisation object:

```bash
curl -s http://localhost:8000/health && echo

curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"CorrectHorse1!","full_name":"Your Name"}' \
  -o /dev/null -w 'register: %{http_code}\n'

curl -s -c /tmp/jar -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"CorrectHorse1!"}' \
  -o /dev/null -w 'login: %{http_code}\n'

curl -s -b /tmp/jar http://localhost:8000/api/v1/auth/me && echo

curl -s -b /tmp/jar -X POST http://localhost:8000/api/v1/organizations \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Org"}'
```

Note that `login` returns no token in the body — only a `Set-Cookie` header. That is
[Decision 1](ENGINEERING_REPORT.md#decision-1--auth-token-storage-httponly-cookie), not
an omission.

## Environment Variables

### `backend/.env` — copied from [backend/.env.example](backend/.env.example)

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | `development` | Set to `production` to mark the auth cookie `Secure` |
| `SECRET_KEY` | `change-me-…` | JWT signing key. **Change it.** |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/ai_support` | Must use the `+asyncpg` driver |
| `TEST_DATABASE_URL` | …`/ai_support_test` | The test suite refuses to run unless this names a database containing `test` — the fixtures drop the schema |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | |
| `MAX_UPLOAD_SIZE_BYTES` | `10485760` | 10 MB, enforced while streaming |
| `UPLOAD_DIR` | `uploads` | Relative to `backend/`; resolved to an absolute path at load |
| `ALLOWED_ORIGINS` | `["http://localhost:3000"]` | JSON array. CORS runs with credentials, so `*` is not an option |

### `frontend/.env.local` — copied from [frontend/.env.example](frontend/.env.example)

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Inlined into the client bundle by the `NEXT_PUBLIC_` prefix — never put a secret behind this name |

Both `.env` files are gitignored.

## Project Structure

```
├── backend/
│   ├── alembic/versions/        # migrations — the only way the schema changes
│   ├── app/
│   │   ├── api/v1/              # routers: auth, conversations, documents, dashboard, organizations
│   │   ├── core/                # config, deps, errors, security
│   │   ├── db/                  # engine + session
│   │   ├── models/              # SQLAlchemy models
│   │   ├── repositories/        # all query logic lives here
│   │   ├── schemas/             # Pydantic request/response models
│   │   └── main.py
│   └── tests/                   # 69 tests, run against a real database
├── frontend/src/
│   ├── app/
│   │   ├── (auth)/              # login, register — no chrome
│   │   ├── (dashboard)/         # sidebar + topbar shell; loading.tsx + error.tsx per route
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/                  # button, card, badge, text-field, confirm-dialog, skeleton
│   │   ├── layout/              # sidebar, topbar, mobile-nav
│   │   ├── dashboard/ conversations/ documents/
│   ├── hooks/  lib/  types/
│   └── proxy.ts                 # route guard (Next 16 renamed middleware.ts → proxy.ts)
└── docs/                        # api.md, schema.md, screenshots/
```

Request flow is `api/v1/<router>.py` → `repositories/<x>_repository.py` → models. There is
no service layer, and that is a decision rather than an oversight —
[Decision 3](ENGINEERING_REPORT.md#decision-3--no-service-layer-router--repository)
explains when it would earn its keep.

## API Documentation

Full reference: **[docs/api.md](docs/api.md)** — all 18 versioned API endpoints, the
`/health` endpoint, the error envelope, and the status codes the API uses.

Interactive: **http://localhost:8000/docs** while the backend is running.

Every error, from any layer, has the same shape:

```json
{ "detail": "Conversation not found", "code": "NOT_FOUND" }
```

Branch on `code`, never on `detail`. Validation errors add a flattened
`errors: [{ field, message }]` array so a form can map them straight onto fields.

## Database Schema

ER diagram and per-table design notes: **[docs/schema.md](docs/schema.md)**.

Six tables — `users`, `organizations`, `user_organizations`, `conversations`, `messages`,
and `documents` — with foreign-key cascades across membership, ownership, organisation
scope, and conversation history. Enums are `VARCHAR + CHECK` rather than native
PostgreSQL `ENUM` types, so adding a status value is a constraint swap instead of an
`ALTER TYPE` that cannot run inside a transaction.

## Testing

```bash
cd backend
pytest                                        # whole suite — 69 tests
pytest tests/test_auth.py::test_login_and_me   # one test
pytest -k ownership                            # by name
```

Coverage is deliberately concentrated on auth, conversation CRUD, ownership isolation,
message ordering, upload validation, and the error envelope.

Three things about the suite are worth knowing:

- **The schema is built by running the real migration**, not `create_all`, so tests
  exercise the deployed schema rather than a schema synthesized directly from models.
  `alembic check` is run separately to detect model/migration drift.
- **Isolation is `TRUNCATE` before each test**, not a transaction rollback. The
  repositories commit their own transactions, so rollback would isolate nothing.
- **Ownership is tested twice**, once against the route guard and once against the
  repository filter, because removing either one alone does not fail the other's test.

Migrations can be checked independently:

```bash
alembic check              # do the models still match the database?
alembic downgrade base     # does downgrade() actually work?
```

The frontend has 16 Playwright E2E tests. Start the backend and frontend first, then run:

```bash
cd frontend
npx playwright install chromium   # one-time browser installation
npm run test:e2e                   # 16 browser tests
```

The E2E suite covers authentication smoke flows, dashboard rendering, mobile overflow,
organization switching and persistence, dashboard cross-org data isolation, conversation
creation/rename/delete, message-history persistence, search-control availability,
document-page rendering, and logout.
Frontend unit/component tests and deeper browser coverage remain future improvements.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `asyncpg.InvalidPasswordError` / `role "postgres" does not exist` | `DATABASE_URL` still has the placeholder credentials | Edit `backend/.env` — Homebrew PostgreSQL usually wants `postgresql+asyncpg://$(whoami)@localhost:5432/ai_support` |
| `connection refused` on port 5432 | PostgreSQL is not running | `brew services start postgresql@18`, then `pg_isready` |
| `sqlalchemy.exc.MissingGreenlet` | `sqlalchemy` installed without the `[asyncio]` extra | Re-run `pip install -e ".[dev]"` |
| Next.js build fails with a syntax or engine error | Node older than 20.9 | `node --version`; upgrade |
| Frontend loads but every request 401s | Backend not running, or `ALLOWED_ORIGINS` does not include `http://localhost:3000` | Start the backend; check `backend/.env` |
| `pytest` errors with "refuses to run" | `TEST_DATABASE_URL` does not name a database containing `test` | The guard is intentional — the fixtures drop the schema, so it must never point at your dev database |
| `pytest` reports "another operation is in progress" | An event-loop scope mismatch | Do not override `asyncio_default_*_loop_scope` in `pyproject.toml` — fixtures and tests must share one loop |

## Assumptions

Scope decisions, the two clarification questions I answered myself, and what is
explicitly out of scope: **[ASSUMPTIONS.md](ASSUMPTIONS.md)**.

Architecture, the three engineering decisions and their alternatives, how AI tools were
used, what went wrong, and known limitations: **[ENGINEERING_REPORT.md](ENGINEERING_REPORT.md)**.
