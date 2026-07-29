# ENGINEERING_REPORT.md

## 1. Project Overview

An AI-ready customer support dashboard: users register and log in, belong to one or more
organisations, own private conversations made up of messages, upload documents (PDF / DOCX /
TXT) whose metadata is stored in PostgreSQL, and search across their conversations by title
*or* message text. Every conversation and document is scoped to the user's currently selected
organisation; switching organisations changes every view without logging out.

**Current state:** the backend is covered by **69 passing integration tests**. The Next.js
frontend implements registration, login, logout, the route guard, the authenticated shell,
the dashboard, conversation CRUD with search and message threads, document upload,
organisation creation, and organisation switching against the real API. **19 Playwright E2E
tests** cover the principal authentication and page smoke flows. The remaining verification
gaps and the deliberately omitted upload progress bar are listed in §6.

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
├── frontend/         Next.js App Router — auth, shell, and all feature pages
└── docs/             ER diagram, API reference
```

### Backend layers

| Layer | Responsibility |
|---|---|
| `api/v1/` | HTTP routing, auth dependency, request/response validation (Pydantic v2) |
| `repositories/` | Reusable resource queries and persistence operations |
| `models/` | SQLAlchemy ORM models, indexes, constraints |
| `core/` | Settings, security helpers, shared dependencies, error handling |
| `alembic/` | Migrations — the only thing that creates or changes schema |

Most requests flow **Router → Repository → model**. The dashboard is the deliberate exception:
its route builds a small set of read-only aggregate queries because they compose several
resources and are used by one endpoint only. There is no service layer; see Decision 3 for
why, and for the point at which I would add one.

### Cross-cutting concerns

**One error shape.** Global handlers in `core/errors.py` mean every failure — deliberate,
validation, or an unhandled bug — leaves the app as `{ detail, code }`. `detail` is for
humans, `code` is for the frontend, which should never match on English prose to decide what
to render. Validation errors add a flattened `errors: [{field, message}]` array so a form can
map problems onto inputs. Unhandled exceptions log the traceback and return a generic 500,
because internal messages leak file paths and queries.

**Ownership is enforced in two independent places, and now covers org membership as well.**
Single-resource routes call `_check_ownership(conversation, current_user, active_org)`, which
checks both `user_id` and `org_id` together. List and dashboard queries filter by both inside
the repository. Both layers are tested independently (`tests/test_ownership.py`) because
removing either one does not fail the other's tests. Cross-user and cross-org access both
return **404, not 403** — a 403 confirms the resource exists, which lets someone enumerate
valid IDs without ever reading one.

**Tests exercise the migrated schema.** The suite builds the test database by running Alembic
rather than `create_all`, so schema-dependent behavior is tested against what is actually
deployed. This does not by itself prove full model/migration parity; `alembic check` is the
separate validation for drift such as a nullability mismatch.

### Frontend

Next.js 16 (App Router), React 19, Tailwind v4, TypeScript. Route groups `(auth)` and
`(dashboard)` give the two areas different chrome without adding a path segment, so the pages
live at `/login` and `/`, not `/auth/login`.

Server Components are the default and fetch on the server, so the signed-in user's name is in
the first HTML response rather than arriving after a client round-trip. `"use client"` is
applied where something is interactive: auth forms, navigation, sign-out, active-organisation
state, feature components, the dashboard, and error boundaries. The dashboard waits for the
server-readable organization cookie on its first render, then uses an org-keyed React Query
request so an in-place organization switch cannot retain a stale Server Component payload.
Conversation detail is loaded by an org-keyed client query as well, preventing a stale
server-cookie context from redirecting a just-created conversation back to the list. The
conversation list and document manager also fetch on the client because their filters and
mutations are client-driven.

React Query handles server-state caching and invalidation instead of Redux or Zustand; almost
all state here is server state, so a global store would add boilerplate without solving a
problem. Rename and both deletes are optimistic, with the previous cache snapshot restored in
`onError`.

**No component library.** The UI is a small set of hand-written Tailwind components
(`button`, `card`, `text-field`, `form-error`, `badge`, `skeleton`, `confirm-dialog`).
shadcn/ui would have reached a polished look faster, but it copies a dozen-plus Radix wrappers
into the repository, and the brief asks that I understand everything I submit. The
accessibility details that a library would have supplied are therefore explicit: `useId` ties
every label to its input, `aria-invalid` and `aria-describedby` connect a validation message
to the field that caused it, and `role="alert"` announces errors when they appear.

**The design system is a token layer, not a component library.** `app/globals.css` holds
every design decision as a CSS custom property in Tailwind v4's `@theme` block — colour
(a brand ramp, then roles like `surface` and `fg-muted`, then semantic status and
per-feature hues), a type scale that carries its own tracking and weight per step, shape,
elevation, and motion. Components name roles (`bg-surface`, `text-fg-muted`), never ramp
steps, so a theme change is one edit here rather than a find-and-replace.

Two things in that file are worth calling out because both are easy to get wrong:

Every foreground/background pair is annotated with its **measured** WCAG ratio, computed
from the sRGB relative-luminance formula rather than estimated. That surfaced two facts
that would otherwise have shipped unnoticed. Muted text on the app background is 4.55:1 —
AA by 0.05, so neither value can move. And four semantic fills (`success`, `warning`,
`info`, and the documents hue) clear the 3:1 required of UI glyphs but *not* the 4.5:1
required of text, so each has a darker `-on` variant for when the same meaning has to be
carried by words. `danger` is the only fill that clears both, which is why
`bg-danger text-white` is sound and copying that pattern to the others would not be.

The focus ring resolves through an inherited `--focus-ring` property rather than a fixed
colour, because no single ring colour clears 3:1 against both a white panel and dark
chrome. A container sets the property; descendants inherit it. This matters because
`Button` renders in both contexts and should not have to know which one it is in.

**Adding a token requires checking Tailwind's own theme first.** Tailwind v4 predefines
`--radius-*`, `--ease-*` and `--shadow-*`. Writing one of those keys does not add a token,
it overrides Tailwind's — silently changing every existing utility that used it, with no
error. Shape and elevation are therefore role-named (`rounded-card`, not `--radius-xl`),
which also reads better at the call site.

The component that most justified pulling in Radix was the modal, and the reason it did not:
**the native `<dialog>` element already does the hard part.** `showModal()` supplies focus
trapping, Escape-to-close, `aria-modal`, background inertness, and a `::backdrop` from the
platform. Both modals in the app — the confirmation dialog and the mobile navigation drawer —
are built on it, and what is left to hand-write is syncing `open` with React state. An earlier
pass had three hand-rolled copies of the confirmation dialog, all three with
`aria-hidden="true"` on the backdrop element that *contained* the dialog, which hides the
whole modal from screen readers; consolidating onto `<dialog>` removed the duplication and the
bug together.

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
- For security-relevant behavior, paired negative checks (the wrong user or organisation gets
  404) with positive controls (the owner in the correct organisation can read the same ID),
  reducing the chance that a test passes only because the fixture never created the resource.

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

**Why it was worth the time:** the suite first went from 3 tests that had never once run to 42
repeatable tests; it now contains 69. The event-loop and isolation fixes are what made the
later feature coverage trustworthy.

---

## 6. Known Limitations

**Largest gaps first:**

- **Frontend automation is useful but not comprehensive.** There are 19 Playwright
  E2E tests covering signed-out redirects, registration, login failures and success,
  signed-in auth-route redirects, dashboard rendering, mobile overflow at 375 px,
  organisation switching with reload persistence, dashboard cross-org data isolation,
  conversation creation/rename/delete, message-history persistence, search-control
  availability, real PDF/DOCX/TXT upload persistence, document deletion, and logout. They do
  not yet verify search results, keyboard focus, or accessibility rules.
  There are also no frontend unit or component tests.
- **No upload progress bar.** `fetch` cannot report request-body progress; a determinate bar
  needs `XMLHttpRequest` or a streaming request body. The upload zone shows an indeterminate
  "Uploading…" state instead of a percentage that would have to be invented.
- **Message threads are not paginated or virtualised** on the client either — the endpoint
  returns the whole thread (below) and the UI renders all of it.

Frontend limitations and shortcuts:

- **The proxy guard is a UX redirect, not authorisation** — it only tests for a cookie's
  presence. §2 covers why that is safe here and what actually enforces access.
- **Client-side validation duplicates the backend's Pydantic rules** in `lib/validation.ts`.
  Two definitions of the same rules can drift; the server is authoritative and its 422 is
  mapped back onto the fields, so drift degrades to a slower error rather than a wrong one.
- **API types are hand-written** to mirror the Pydantic schemas rather than generated from the
  OpenAPI document. Small surface, no codegen step — but nothing enforces that they still match.
- **The signed-in user is fetched twice per dashboard load.** The layout calls `/auth/me` to
  gate the shell; the page calls `/dashboard/summary`, which also returns the user. React's
  `cache` dedupes repeated calls to the *same* function within a render, but these are different
  endpoints. Removing the second would mean the shared layout depending on a dashboard-specific
  endpoint that `/conversations` and `/documents` have no use for, so the duplicate is
  deliberate — and still fewer round-trips than the four this page would otherwise make.
- **`npm audit` reports 12 high-severity advisories**, all dev-only transitive dependencies of
  ESLint and PostCSS (`brace-expansion`, `minimatch`). The fix is a breaking `eslint@10`
  upgrade; none of it ships in the production bundle, so it is recorded rather than forced.

Backend limitations and shortcuts:

- **Upload MIME type is validated against magic bytes** for PDF and DOCX; `text/plain` has no universal signature so it relies on the declared content type. The extension written to disk is chosen from a server-side map so a hostile filename cannot escape the upload directory.
- **Files are stored on local disk**, which does not survive multiple instances. `storage_path`
  is the single column that changes if this moves to S3 with presigned URLs.
- **The messages endpoint has no pagination** — a very long conversation returns in full.
- **No refresh token rotation**; a single access token with a 24-hour lifetime.
- **No rate limiting** anywhere, so login is open to brute force.
- **Search is a sequential scan** (see Decision 2).
- **No CI pipeline** — tests are run locally.
- **Timestamps are UTC only**, with no per-user timezone. The display locale is pinned to
  `en-GB` in `lib/utils.ts` rather than following the browser: "runtime default" resolves to
  Node's locale on the server and the browser's on the client, and when those disagree the
  same instant server-renders one way and hydrates another — which React reports as a
  hydration mismatch. Determinism was worth more here than a locale the API has no notion of,
  but a real product would send the user's preference rather than choosing for them.

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

I would deepen the Playwright suite beyond its 19 tests with search-result assertions and
failure-path coverage. I would also add focused component tests for validation,
query-key scoping, and failure states, because they are faster and more deterministic than
recreating every edge case through a browser. The hydration bug found while polishing is the
argument for browser coverage: it had been invisible in review, and a browser found it in
seconds.

After that, in order:

1. **Accept-invitation flow.** The current invite is immediate — an admin adds a user and
   they are a member instantly. A real product would instead create a *pending invitation*
   that the target user must accept. This needs an `invitations` table
   (`id`, `org_id`, `inviter_id`, `invitee_email`, `role`, `status`, `created_at`,
   `expires_at`), a `POST /invitations/{id}/accept` endpoint, an email notification (or
   at minimum an in-app notification badge), and an expiry policy. The current design was
   chosen because it is correct and complete for the scope — every invite results in a
   working membership — and the accept step is additive rather than a rework.
2. Paginating the messages endpoint.
3. Adding refresh token rotation.

**What part took the longest?**

Not the features — the endpoints and schema came together quickly. The time went into making
the project actually runnable and verifiable: a synchronous Alembic environment that could
never work with an async driver, a package that would not install, hashing that crashed on
any modern `bcrypt`, and the test suite described in §5. That work is invisible in a feature
list, but it is what makes everything else in this report a checked claim rather than an
assumption.

---

## 8. Requirement Update — Multi-Organization Support

### What changed

After the original submission, the brief was extended with a multi-organisation requirement:
every conversation and document must belong to exactly one organisation, a user may belong to
multiple organisations, and users must be able to switch organisations without logging out.
All views — dashboard, conversations, documents, search — must be scoped to the currently
selected organisation.

This touched every layer of the stack. The changes are described below in the order I made
them, which is also the order that makes the reasoning easiest to follow.

---

### Parts of the system affected

| Layer | What changed |
|---|---|
| Database | 2 new tables, 2 new FK columns, 2 new composite indexes |
| Backend models | `Organization`, `UserOrganization`; `org_id` on `Conversation` and `Document` |
| Backend repositories | New `OrganizationRepository`; all list/create queries gain `org_id` filter |
| Backend API | New `/api/v1/organizations` router (CRUD, list members, invite by email); `get_active_org` dependency on all scoped routes |
| Backend tests | 14 new tests in `test_organizations.py`; 5 new cross-org tests in `test_ownership.py`; all existing fixtures updated |
| Frontend types | `Organization`, `Membership`, `OrganizationCreated` added; `Conversation`, `Document`, `DashboardSummary` updated |
| Frontend state | `OrgContext` + `OrgProvider` — active org stored in React context, `localStorage`, and a plain cookie |
| Frontend API layer | `useOrgFetch` hook injects `X-Org-ID` on client calls; `serverApiFetch` reads the cookie and forwards it on server calls |
| Frontend UI | `OrgSwitcher` dropdown + `CreateOrgDialog` modal in the topbar; `MembersContent` page with `InviteMemberDialog` |

---

### Database changes

**New tables:**

- `organizations` — `id` (UUID PK), `name` (VARCHAR 255 NOT NULL), `created_at`
- `user_organizations` — composite PK `(user_id, org_id)`, `role` (VARCHAR + CHECK:
  `member` or `admin`), `joined_at`; both FKs cascade on delete

**New columns:**

- `conversations.org_id` — FK → `organizations.id`, `ON DELETE CASCADE`, introduced as
  nullable for backfill and made `NOT NULL` by the follow-up migration
- `documents.org_id` — same

**Index changes:**

- `ix_conversations_user_updated` → `ix_conversations_org_user_updated` on
  `(org_id, user_id, updated_at)`. `org_id` leads because it is the coarser filter and
  every list query now carries it.
- `ix_documents_user_id` → `ix_documents_org_user` on `(org_id, user_id)`.

The organisation migration (`a1b2c3d4e5f6`) is fully reversible. Its follow-up
(`b2c3d4e5f6a7`) assigns legacy resources to the user's earliest membership, creating a
default admin workspace only when the user has none, then sets both resource columns
`NOT NULL`. Its downgrade restores nullable columns before the earlier migration drops
indexes, FK constraints, and columns in reverse order.

---

### Key design decisions

**Decision 4 — Active-org transport: `X-Org-ID` request header**

| | JWT claim | Separate cookie | **`X-Org-ID` header (chosen)** |
|---|---|---|---|
| Switch without re-login | ❌ needs new token | ✅ | ✅ |
| Stateless server | ✅ | ✅ | ✅ |
| Explicit in every request | ✅ | ❌ implicit | ✅ |
| SSR-friendly | ❌ re-issue on switch | Awkward | ✅ set in `fetch` options |
| CSRF risk | None | Needs `SameSite` | None — same-origin policy blocks custom headers |

A JWT claim would require re-issuing the token on every org switch, coupling identity and
workspace into the same credential and making switching feel like a partial re-login. A
separate cookie is sent automatically by the browser, which makes it invisible to `fetch`
calls that do not explicitly forward it, and it is awkward to read in Next.js Server
Components without going through the `cookies()` API on every request.

The header is explicit, stateless, easy to test with `curl` or Postman, and carries no CSRF
risk because the same-origin policy blocks custom headers from cross-origin requests.

**`get_active_org` dependency** (`app/core/deps.py`) reads `X-Org-ID`, verifies that the
authenticated user is a member of that org, and returns the `Organization` row. Membership
is checked on every request — a user removed from an org between requests is rejected on the
next call. The response is always **404, never 403** — a 403 would confirm the org exists to
a non-member, the same information-leak avoided on conversations.

---

**Decision 5 — Org membership model: join table with role column**

`user_organizations` is a standard many-to-many join table with a `role` column
(`member` / `admin`). The alternative — a flat list of org IDs on the user — cannot express
roles without a parallel structure. The join table covers both the simple case (membership
check) and the richer case (admin-only invite) without a schema change.

Role is stored as `VARCHAR + CHECK` with `create_constraint=True`, consistent with the
existing enum pattern in the codebase (see §4 — the missing-constraint bug).

**Org creation is atomic.** `OrganizationRepository.create` uses `flush()` to obtain the
org's UUID before inserting the membership row, then commits both in a single transaction.
The org never exists without at least one admin.

---

**Decision 6 — Frontend org state: React context + localStorage + plain cookie**

The active org is UI state, not server state — the server does not know which org is
"active"; it only knows which org the request is scoped to via `X-Org-ID`. Three storage
layers work together:

| Layer | Purpose |
|---|---|
| React context (`OrgContext`) | In-memory; drives the `OrgSwitcher` UI and `useOrgFetch` |
| `localStorage` | Survives page refresh; restored on mount |
| Plain (non-httpOnly) cookie | Readable by Next.js Server Components via `serverApiFetch` and used to bootstrap dashboard context |

The cookie is the key insight. `localStorage` is not readable on the server, so the dashboard
bootstrap and any server-side scoped call would otherwise have no organization context. A
plain cookie is readable via `cookies()` and `serverApiFetch` can forward it as `X-Org-ID`.
Interactive dashboard and conversation-detail data use org-keyed client queries for immediate
in-place switches. The cookie carries no secret — the backend validates membership on every
request regardless.

**`useOrgFetch` hook** (`src/hooks/use-org-fetch.ts`) wraps `apiFetch` and closes over
`orgId` from context, injecting `X-Org-ID` on every call. This keeps `apiFetch` as a plain
async function with no React dependency, and avoids threading `orgId` as an argument through
every call site. When the user switches orgs, `OrgProvider` clears the entire React Query
cache — every query re-fetches on the next render with the new org id.

---

### What the test suite covers

The test count grew from 42 to **69**. New coverage:

- `tests/test_organizations.py` (14 tests) — create, list, add member, duplicate guard,
  admin-only enforcement, `get_active_org` dependency (missing header → 400, non-member → 404,
  newly-invited member can immediately use the org), default workspace created on registration
- `tests/test_ownership.py` — 5 new cross-org tests: same user, two orgs — org-A data is
  invisible from org-B context; non-member org returns 404; missing header returns 400;
  a "protection is real" test that switches back to org-A and confirms the conversation is
  visible again (proving the 404 was caused by the org check, not a bug)
- All existing `auth_client` fixtures in `test_conversations.py`, `test_documents.py`, and
  `test_messages.py` updated to create an org and set `X-Org-ID` — the existing tests pass
  unchanged because the header is now always present
- `tests/test_dashboard.py` (7 tests) — summary shape, counts reflect created data, recent
  lists capped at 5, authentication required, org header required, org-scoped counts reset
  on switch, `current_org` present in response

The cross-org tests pair denied requests with positive controls in the correct organisation,
so a 404 caused by a missing fixture cannot masquerade as successful authorization coverage.

---

### Deferred items

**Legacy-row backfill policy.** `org_id NOT NULL` is now enforced by a follow-up migration.
For deterministic upgrades, pre-organisation resources are assigned to their owner's earliest
membership; a default admin workspace is created only for a legacy user who has no membership.
A production migration with externally defined tenant mappings could replace that policy, but
the submitted migration preserves every legacy row and produces a valid final schema.

**Member management UI.** The frontend now includes a dedicated **Members** page
(`/members`) and an **Invite member** dialog. Admins can invite registered users by email
address, choose a role (member or admin), and see the full member list with names, emails,
roles, and join dates. The backend gained two new endpoints to support this:
`GET /organizations/{org_id}/members` (list members with user details) and
`POST /organizations/{org_id}/members/invite` (invite by email, admin-only). The invite
flow is immediate — the target user is added to the organisation as soon as the admin
submits the form, with no pending/accept step (see §7 for the accept-invitation design
that would follow with more time).

**Org deletion.** Not implemented. Deleting an org would cascade-delete all its
conversations and documents — a destructive operation that warrants a deliberate design
decision (soft delete? transfer ownership? confirmation with typed org name?) rather than a
quick implementation. The backend has no `DELETE /organizations/{id}` endpoint.
