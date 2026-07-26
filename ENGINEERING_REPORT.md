# ENGINEERING_REPORT.md

## 1. Project Overview

An AI-ready customer support dashboard: users register and log in, own private
conversations made up of messages, upload documents (PDF / DOCX / TXT) whose metadata is
stored in PostgreSQL, and search across their conversations by title *or* message text.

**Current state:** the backend is complete and covered by 42 passing tests. The Next.js
frontend is **partially built**: registration, login, logout, the route guard, and the
authenticated application shell all work end to end against the real API. The dashboard,
conversation, and document *pages* are still placeholders. §6 says which is which — the
distinction matters more than a percentage, and I would rather state it plainly than let a
screenshot imply the rest is finished.

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
├── frontend/         Next.js App Router — auth + shell built, feature pages pending
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

### Frontend

Next.js 16 (App Router), React 19, Tailwind v4, TypeScript. Route groups `(auth)` and
`(dashboard)` give the two areas different chrome without adding a path segment, so the pages
live at `/login` and `/`, not `/auth/login`.

Server Components are the default and fetch on the server, so the signed-in user's name is in
the first HTML response rather than arriving after a client round-trip. `"use client"` is
applied only where something is genuinely interactive — the two forms, the nav (it needs
`usePathname`), and the sign-out button. React Query handles server-state caching and
invalidation instead of Redux or Zustand; almost all state here is server state, so a global
store would add boilerplate without solving a problem.

**No component library.** The UI is a small set of hand-written Tailwind components
(`button`, `card`, `text-field`, `form-error`). shadcn/ui would have reached a polished look
faster, but it copies a dozen-plus Radix wrappers into the repository, and the brief asks that
I understand everything I submit. The accessibility details that a library would have supplied
are therefore explicit: `useId` ties every label to its input, `aria-invalid` and
`aria-describedby` connect a validation message to the field that caused it, and `role="alert"`
announces errors when they appear.

**One error path.** The backend's `{ detail, code }` envelope is unwrapped once, in
`lib/api-client.ts`, into an `ApiError` carrying `status`, `code`, and the flattened
`fieldErrors`. Forms branch on `code`, never on `detail` — the backend documents `detail` as
human prose, so matching on it would break the UI on a copy edit. A 422's `errors` array is
mapped back onto the offending inputs, which is the reason the backend flattens it.

**Two layers of route protection, and only one of them is real.**

The first is `src/proxy.ts` — `proxy`, not `middleware`: Next.js 16 renamed the convention and
deprecated the old filename, and the file belongs beside `app/` rather than inside it, where it
would be an ordinary module that never runs. It redirects a request with no `access_token`
cookie to `/login`.

It is worth being exact about what that buys, because it is the easiest thing in this project
to overstate. **The proxy checks only that a cookie exists.** It never verifies the signature
or the expiry, so anyone can set `access_token=nonsense` in devtools and walk straight past it.
Next's own documentation says the same thing — proxy is for "optimistic checks", not
authorisation.

The second layer is the one that holds. The `(dashboard)` layout is a Server Component that
calls `GET /auth/me` and redirects when it comes back 401, and every `/api/v1` route validates
the cookie independently. So the proxy's job is purely to avoid a wasted server render for the
common signed-out case, and correctness never depends on it.

I verified this rather than assuming it. With a forged cookie the proxy passes the request
through, `getCurrentUser()` receives a 401 from the backend, and the layout redirects — the
browser gets a 307 to `/login`, and the same forged token against `/api/v1/auth/me` returns
401. A guard that has never been tested against the case it exists for is a guess.

---

## 3. Engineering Decisions

### Decision 1 — Auth token storage: `httpOnly` cookie

| | **Chosen: `httpOnly` cookie** | Alternative: `localStorage` |
|---|---|---|
| XSS safety | JavaScript cannot read it | Fully readable by any injected script |
| CSRF risk | Needs `SameSite` (set to `Lax`) | Not applicable |
| SSR access | Readable in Next.js `proxy.ts` | Unavailable server-side |

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

- **The frontend's feature pages are not built.** What works end to end today is register,
  login, logout, the route guard, and the authenticated shell (sidebar, top bar, navigation).
  `/`, `/conversations`, and `/documents` render their heading and a note, not their data — so
  conversation CRUD, message threads, search, and document upload are currently reachable only
  through the API. The endpoints behind all of them are complete and documented in
  `docs/api.md`.
- **The frontend has no automated tests.** The backend has 42; the UI was verified by driving
  the real flow against a running API — signed-out redirect, valid-cookie render, forged-cookie
  rejection, and the already-signed-in bounce off `/login`. That is a check I ran, not a check
  that runs. A regression here would not fail anything.

Frontend limitations and shortcuts:

- **The proxy guard is a UX redirect, not authorisation** — it only tests for a cookie's
  presence. §2 covers why that is safe here and what actually enforces access.
- **Client-side validation duplicates the backend's Pydantic rules** in `lib/validation.ts`.
  Two definitions of the same rules can drift; the server is authoritative and its 422 is
  mapped back onto the fields, so drift degrades to a slower error rather than a wrong one.
- **API types are hand-written** to mirror the Pydantic schemas rather than generated from the
  OpenAPI document. Small surface, no codegen step — but nothing enforces that they still match.
- **`npm audit` reports 12 high-severity advisories**, all dev-only transitive dependencies of
  ESLint and PostCSS (`brace-expansion`, `minimatch`). The fix is a breaking `eslint@10`
  upgrade; none of it ships in the production bundle, so it is recorded rather than forced.

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

Finish the frontend's feature pages. The shell and the auth flow are in place, so the remaining
work is the dashboard summary, conversation CRUD with search, and the upload UI — nothing else
would improve the result as much, because those are the features the brief actually names.

After that, in order: a handful of frontend tests (the UI is the only part of the project with
no automated coverage), replacing `python-jose` with `PyJWT`, sniffing magic bytes on upload
instead of trusting the client's header, and paginating the messages endpoint.

**What part took the longest?**

Not the features — the endpoints and schema came together quickly. The time went into making
the project actually runnable and verifiable: a synchronous Alembic environment that could
never work with an async driver, a package that would not install, hashing that crashed on
any modern `bcrypt`, and the test suite described in §5. That work is invisible in a feature
list, but it is what makes everything else in this report a checked claim rather than an
assumption.
