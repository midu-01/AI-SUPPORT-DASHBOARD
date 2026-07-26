# ENGINEERING_REPORT.md

## 1. Project Overview

An AI-ready customer support dashboard: users register and log in, own private
conversations made up of messages, upload documents (PDF / DOCX / TXT) whose metadata is
stored in PostgreSQL, and search across their conversations by title *or* message text.

**Current state:** the backend is complete and covered by 42 passing tests. **The Next.js
frontend is not implemented** — the API is finished and documented, but there is no UI yet.
This is the largest gap in the submission and I would rather state it plainly than imply
otherwise; §6 lists it first.

"AI-ready" is interpreted as a requirement on the *data model*, not on behaviour. No LLM is
called anywhere. Instead `messages.role` (`user` / `assistant`) and `documents.status`
(`uploaded` / `processing` / `indexed` / `failed`) exist so an inference or indexing layer
could be added later without a schema change. Reasoning is in `ASSUMPTIONS.md`.

Stack: FastAPI, SQLAlchemy 2.0 async (`asyncpg`), Alembic, PostgreSQL 18, Pydantic v2.

---

## 2. Architecture

```
ai-support-dashboard/
├── backend/          FastAPI — Router → Repository
├── frontend/         Next.js App Router — NOT YET IMPLEMENTED
└── docs/             ER diagram, API reference
```

### Backend layers

| Layer | Responsibility |
|---|---|
| `api/v1/` | HTTP routing, auth dependency, request/response validation (Pydantic v2) |
| `repositories/` | Every database query lives here — routers never build SQL |
| `models/` | SQLAlchemy ORM models, indexes, constraints |
| `core/` | Settings, security helpers, shared dependencies, error handling |
| `alembic/` | Migrations — the only thing that creates or changes schema |

A request flows **Router → Repository → model**. There is no service layer; see Decision 3
for why, and for the point at which I would add one.

### Cross-cutting concerns

**One error shape.** Global handlers in `core/errors.py` mean every failure — deliberate,
validation, or an unhandled bug — leaves the app as `{ detail, code }`. `detail` is for
humans, `code` is for the frontend, which should never match on English prose to decide what
to render. Validation errors add a flattened `errors: [{field, message}]` array so a form can
map problems onto inputs. Unhandled exceptions log the traceback and return a generic 500,
because internal messages leak file paths and queries.

**Ownership is enforced in two independent places.** Single-resource routes check the owner
after loading; list and dashboard queries filter by `user_id` inside the repository. Both are
tested separately, because removing either one does not fail the other's tests. Cross-user
access returns **404, not 403** — a 403 confirms the resource exists, which lets someone
enumerate valid IDs without ever reading one.

**Migrations are the single source of schema truth**, including in tests: the suite builds the
test database by running the real migration rather than `create_all`, so a migration that
drifts from the models fails the build instead of shipping.

### Frontend (planned, not built)

The intended design, for completeness: Server Components fetch initial data so there is no
client-side request waterfall, `"use client"` only where interactivity is needed, and React
Query for server-state caching and invalidation rather than Redux or Zustand — almost all
state in this app is server state, so a global store would add boilerplate without solving a
problem. The `httpOnly` cookie from Decision 1 is readable in Next.js `middleware.ts`, which
is what would protect routes server-side.

---

## 3. Engineering Decisions

### Decision 1 — Auth token storage: `httpOnly` cookie

| | **Chosen: `httpOnly` cookie** | Alternative: `localStorage` |
|---|---|---|
| XSS safety | JavaScript cannot read it | Fully readable by any injected script |
| CSRF risk | Needs `SameSite` (set to `Lax`) | Not applicable |
| SSR access | Readable in Next.js middleware | Unavailable server-side |

**Why:** an XSS bug anywhere in the app would hand an attacker a `localStorage` token
outright. `SameSite=Lax` covers the CSRF exposure that a cookie introduces, and it is the
only option that also works for server-side route protection.

**The follow-through matters more than the choice.** Login does *not* also return the token
in its JSON body, and the response model is named `LoginResponse`, not `TokenResponse`.
Returning the token in the body would hand JavaScript the exact value `httpOnly` exists to
hide — cancelling out the protection while appearing to implement it.

Trade-off accepted: `secure=False` in local development because there is no HTTPS. It is
derived from `APP_ENV`, so it is on everywhere else.

### Decision 2 — Search: `ILIKE` across titles and message text

| | **Chosen: `ILIKE`** | PG FTS (`tsvector` + GIN) | Elasticsearch / pgvector |
|---|---|---|---|
| Complexity | Low | Medium | High |
| Index support | None — sequential scan | GIN index | Inverted / vector index |
| Ranked results | No | Yes (`ts_rank`) | Yes |
| Extra infrastructure | None | None | A service to run |

**Why:** searching *message content* matters more here than the indexing strategy. Titles are
short and often generic, so what a user actually remembers is something that was said. `ILIKE`
across both `conversations.title` and `messages.content` delivers that without a schema change.

Two details that are easy to get wrong:

- User input is escaped, so a search for `50%` matches the literal text rather than behaving
  as a wildcard that matches everything.
- The message match uses `Conversation.messages.any(...)`, which compiles to an `EXISTS`
  subquery. A `JOIN` would return the same conversation once per matching message and need
  `DISTINCT` to hide it.

**Honest limitation:** `ILIKE '%q%'` cannot use a B-tree index, so this is a sequential scan.
At this data size that is fine, and I preferred something I can explain end to end. The
upgrade path is a generated `tsvector` column with a GIN index and `ts_rank` ordering, which
also brings ranking; pgvector for semantic search would come after that.

### Decision 3 — No service layer: Router → Repository

| | **Chosen: Router → Repository** | Alternative: Router → Service → Repository |
|---|---|---|
| Indirection | One hop to the data | Two hops, mostly pass-through |
| Where logic lives | Thin routers; queries in repositories | Services own orchestration |
| Cost when logic grows | Must introduce the layer later | Already in place |

**Why:** at this scope, nearly every endpoint is *authorise, then one query*. A service layer
would consist mainly of methods forwarding straight to a repository, which adds a file to read
for no decision-making. The repository boundary is the one that earns its keep, because it
keeps SQL out of HTTP handlers and makes queries testable on their own.

**When I would add one:** as soon as an operation spans multiple repositories in a single
transaction, or business rules stop being per-endpoint. Adding messages already hints at this —
it inserts a message *and* bumps the parent conversation's `updated_at`, which currently sits in
the message repository. A second such case is the point where I would extract services rather
than keep widening a repository.

I originally described the architecture in this report as Router → Service → Repository with an
empty `services/` package. That was aspiration, not fact, so I corrected the report to match
the code. Documentation that overstates the implementation is worse than an omission, because
it is discovered in review.

---

## 4. AI Collaboration

**Tools used:** Claude (Claude Code) and GitHub Copilot.

**Workflow:** I designed the schema and the layering myself, then used AI for boilerplate —
models, Pydantic schemas, repository methods, test scaffolding — and as a reviewer to argue
against my own choices. I reviewed every line before committing, and treated anything touching
the database or auth as suspect until I had seen it work.

**Where AI helped significantly:** async infrastructure I had not written before. Alembic's
default `env.py` is synchronous and cannot run against an `asyncpg` URL; the working shape uses
`async_engine_from_config` and hands Alembic a sync-style connection through
`connection.run_sync`. Getting there from the docs alone would have cost me hours. The same
applied to the async session factory and `pydantic-settings` v2's `model_config`.

**Where AI produced an incorrect solution:** the enum columns. The generated models used

```python
SAEnum(MessageRole, native_enum=False, length=20)
```

which looks like it creates a `VARCHAR` plus a `CHECK` constraint, and reads as though the
database validates the value. It does not — SQLAlchemy defaults `create_constraint` to
`False`, so the migration emitted a plain `VARCHAR(20)` **with no constraint at all**. Any
string would have been accepted. The code looked correct in review; the only way to catch it
was to inspect the built table:

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype = 'c';
-- (0 rows)
```

Adding `create_constraint=True` fixed it, and a raw `INSERT` of `role = 'hacker'` is now
rejected by PostgreSQL. Three smaller cases followed the same pattern of plausible-but-wrong:
`passlib[bcrypt]` was suggested for hashing (its last release is from 2020 and it crashes
against `bcrypt >= 4.1`, so hashing failed outright); a test fixture used
`session.rollback()` for isolation, which does nothing because the repositories commit their
own transactions; and login reused the registration schema, so signing in demanded a
`full_name`.

**How I validated AI-generated code:** by not trusting that it read correctly.

- Inspected the real database with `psql` rather than the models — this is what caught the
  missing constraints, and confirmed the `CASCADE` deletes and indexes actually exist.
- Ran `alembic downgrade base` then `upgrade head`, because an untested `downgrade()` is
  usually broken.
- Exercised the API over HTTP against a running server, not only through the test client.
- For the security-relevant test, deliberately removed the ownership check and confirmed the
  test **failed**. A test that passes for the wrong reason is worse than no test.

---

## 5. Challenges

**The hardest problem: an async test suite that could not talk to the database.**

Every test failed with one of two messages from `asyncpg` — `cannot perform operation:
another operation is in progress`, or `RuntimeError: Task ... attached to a different loop`.
Both are misleading. Neither mentions the actual cause, and the first suggests a concurrency
bug in the application, which sent me looking in the wrong place first: I checked whether the
test client and the app were sharing a session concurrently, then whether a dependency
override was yielding the same connection twice.

The real cause was **event loop scope**. `pytest-asyncio` gives session-scoped fixtures their
own event loop, while tests default to a per-function loop. The fixture that created the
schema opened its connections on the session loop; those connections went back into
SQLAlchemy's pool, and the tests then borrowed them on a *different* loop. An asyncpg
connection is bound to the loop that created it, so every reuse failed.

Two changes fixed it, and the second is the one that makes it robust:

1. Configure fixtures **and** tests to share a single session-scoped loop.
2. Give the test engine `NullPool`, so no connection is ever reused across loops even if the
   scoping changes again later.

While fixing it I found the isolation was fake too. The fixture called `session.rollback()`
between tests, but the repositories commit their own transactions, so by the time a test ended
its writes were already durable — tests were only passing in a specific order and would have
broken on a second run. Isolation is now `TRUNCATE` before each test, and the suite passes
repeatedly.

**Why it was worth the time:** the suite went from 3 tests that had never once run to 42 that
run twice in a row unchanged, and the fix is what let me verify everything else in this report.

---

## 6. Known Limitations

**Largest gap first:**

- **The Next.js frontend is not implemented.** The backend API is complete, documented in
  `docs/api.md`, and browsable via Swagger UI at `/docs`, but there is no UI.

Backend limitations and shortcuts:

- **Upload MIME type is taken from the client's `Content-Type` header**, which is spoofable.
  The extension written to disk is chosen from a server-side map so a hostile filename cannot
  escape the upload directory, but real validation means sniffing magic bytes.
- **`python-jose` is unmaintained** (CVE-2024-33663, CVE-2024-33664). It should be replaced
  with `PyJWT`.
- **Files are stored on local disk**, which does not survive multiple instances. `storage_path`
  is the single column that changes if this moves to S3 with presigned URLs.
- **The messages endpoint has no pagination** — a very long conversation returns in full.
- **No refresh token rotation**; a single access token with a 24-hour lifetime.
- **No rate limiting** anywhere, so login is open to brute force.
- **Search is a sequential scan** (see Decision 2).
- **No CI pipeline** — tests are run locally.
- **Timestamps are UTC only**, formatted client-side, with no per-user timezone.

---

## 7. Reflection

**What did you learn?**

Two things stuck. First, that async Python has a failure mode I had not met before: the object
that breaks is not the object that is wrong. An `asyncpg` connection carries a hidden
attachment to the event loop that created it, and the error surfaces far from the fixture
scope that caused it. Second, and more useful: **a database constraint is not real until you
have looked at the database.** The enum bug read as correct in the model, in the migration, and
in review — it was only visible in `pg_constraint`. I now inspect the built schema rather than
trusting the code that generated it.

**If you had one additional day, what would you improve?**

Build the frontend — it is the missing half of the submission, and nothing else would improve
the result as much. With time left over: replace `python-jose` with `PyJWT`, sniff magic bytes
on upload instead of trusting the client's header, and paginate the messages endpoint.

**What part took the longest?**

Not the features — the endpoints and schema came together quickly. The time went into making
the project actually runnable and verifiable: a synchronous Alembic environment that could
never work with an async driver, a package that would not install, hashing that crashed on
any modern `bcrypt`, and the test suite described in §5. That work is invisible in a feature
list, but it is what makes everything else in this report a checked claim rather than an
assumption.
