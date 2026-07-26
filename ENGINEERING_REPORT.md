# ENGINEERING_REPORT.md

## 1. Project Overview

AI-Ready Customer Support Dashboard — a full-stack web application built with FastAPI (backend), Next.js App Router (frontend), and PostgreSQL (database). Users can register, log in, manage support conversations with message history, upload document metadata, and search across conversations.

---

## 2. Architecture

```
ai-support-dashboard/
├── backend/          FastAPI — layered: Router → Service → Repository
├── frontend/         Next.js App Router — Server Components + React Query
└── docs/             Schema diagram, API reference
```

**Backend layers:**
- `api/v1/` — HTTP routing, request/response validation (Pydantic v2)
- `services/` — business logic (orchestrates repositories)
- `repositories/` — all DB queries (SQLAlchemy async)
- `models/` — SQLAlchemy ORM models
- `core/` — config, security helpers, shared dependencies

**Frontend layers:**
- Server Components fetch initial data (no client waterfall)
- `"use client"` only where interactivity is needed
- React Query manages server-state caching and invalidation

---

## 3. Engineering Decisions

### Decision 1 — Auth Token Storage: `httpOnly` Cookie vs `localStorage`

| | Chosen: `httpOnly` cookie | Alternative: `localStorage` |
|---|---|---|
| XSS safety | ✅ JS cannot read it | ❌ Fully exposed to XSS |
| CSRF risk | Mitigated with `samesite="lax"` | N/A |
| Next.js SSR | ✅ Readable in middleware | ❌ Not available server-side |

FastAPI sets the cookie with `response.set_cookie(httponly=True, samesite="lax")`. Next.js `middleware.ts` reads it to protect routes server-side.

---

### Decision 2 — Search: `ILIKE` vs PostgreSQL FTS vs Elasticsearch

| | Chosen: `ILIKE` | PG FTS (`tsvector` + GIN) | Elasticsearch |
|---|---|---|---|
| Complexity | Low | Medium | High |
| Index support | ❌ Sequential scan | ✅ GIN index | ✅ Inverted index |
| Ranked results | ❌ | ✅ `ts_rank` | ✅ |
| Extra infra | None | None | Separate service |

Chosen `ILIKE` across `conversations.title` and `messages.content`. At this data scale a sequential scan is acceptable, and I can explain every line. The upgrade path is a generated `tsvector` column + GIN index + `ts_rank` ordering; pgvector for semantic search comes after that.

---

### Decision 3 — Frontend State: React Query vs Redux/Zustand

| | Chosen: React Query + Server Components | Redux / Zustand |
|---|---|---|
| Server state | ✅ Built-in caching, invalidation, refetch | Manual boilerplate |
| Client state | `useState` for local UI | Global store |
| SSR integration | ✅ Server Components fetch on server | Complex hydration |

Almost all state in this app is server state. A global store adds complexity without benefit here.

---

## 4. AI Collaboration

**Tools used:** GitHub Copilot, Claude

**Workflow:** Designed the schema and architecture first, then used AI to generate boilerplate (models, schemas, repository methods). Reviewed every generated line before committing.

**Where AI helped:** Async SQLAlchemy session setup, Alembic `env.py` configuration, Pydantic v2 `model_config` syntax.

**Where AI was wrong:** *(Fill in with a real example while building — e.g. deprecated `orm_mode`, wrong async pattern, etc.)*

**Validation:** Manual review of all generated code, tests, and manual API testing via `/docs` (Swagger UI).

---

## 5. Challenges

*(Fill in after building — describe the hardest technical problem encountered and how it was solved.)*

---

## 6. Known Limitations

- No refresh token rotation (access token only)
- Local file storage — production would use S3 presigned URLs
- No rate limiting on any endpoint
- Messages endpoint has no pagination
- No CI/CD pipeline
- Search uses `ILIKE` (sequential scan) — not suitable for large datasets

---

## 7. Reflection

*(Fill in after building)*

- **What did you learn?**
- **If you had one additional day, what would you improve?**
- **What part took the longest?**
