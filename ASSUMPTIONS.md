# Assumptions & Scope Decisions

The brief intentionally leaves parts of the specification open and allows up to two
clarification questions. I chose **not to use them** and to document my assumptions
instead — every ambiguity I found had a defensible default, and picking one and stating
it clearly is faster than blocking on an answer.

This document records what I assumed, what I deliberately left out, and why. Where an
assumption meaningfully shaped the schema or the API, the reasoning is spelled out so it
can be challenged.

---

## 1. The two questions I chose not to ask

### Q1 — Are real AI/LLM replies expected in conversations, or is this message CRUD?

**Assumed: message CRUD only. No LLM is called anywhere in this application.**

The brief states that "actual AI document processing is not required" and describes the
deliverable as "AI-ready". I read *AI-ready* as a statement about the **data model and
architecture**, not about behaviour: the system should be shaped so that an AI layer can
be added without a migration or a redesign.

Concretely, that means:

- `messages.role` is an enum (`user` / `assistant`) even though only `user` rows are
  written today. Adding assistant replies later is an insert, not a schema change.
- `documents.status` is an enum (`uploaded` / `processing` / `indexed` / `failed`) with a
  future ingestion pipeline in mind. Every row stays `uploaded` in this build.
- No API keys, no model SDK, no mock "fake AI" reply generator. A stubbed assistant that
  echoes text would be visible product behaviour I'd then have to defend, and the brief
  explicitly warns against building what it didn't ask for.

### Q2 — For document upload, is the file physically stored, or only a metadata row?

**Assumed: the file is written to local disk; the database stores only metadata.**

The brief says "only store document metadata", which I read as a constraint on the
*database* and on *processing* — not an instruction to discard the bytes. Two reasons for
persisting them:

1. Size and type validation is only honest if the upload is actually read. Trusting a
   client-declared size means the limit isn't enforced.
2. `documents.storage_path` becomes the seam where object storage plugs in later.

Files go to a local `uploads/` directory, named by generated UUID (never by the
client-supplied filename — that's a path-traversal vector). The original name is kept in
a separate column for display. In production this becomes S3 with presigned uploads, and
the only thing that changes is the storage adapter behind `storage_path`.

---

## 2. Domain model

| Assumption | Reasoning |
|---|---|
| Single-tenant, user-scoped data | No organisation, team, or workspace concept. Every row is owned by exactly one user. |
| No roles or RBAC | There is one kind of user. An `is_admin` flag with nothing to administer is dead weight. |
| A conversation is a titled thread of messages owned by one user | Matches "create / rename / delete / view history" in the brief. |
| Conversations are never shared between users | No collaborators table, no permission grants. Ownership is a single FK. |
| Messages are immutable once created | No edit or delete on individual messages — the brief asks for conversation CRUD, not message CRUD. |
| UUID (v4) primary keys | Prevents ID enumeration across user-scoped resources, and keeps IDs safe to generate client-side or across services later. Cost: slightly wider indexes than `bigserial`, which is irrelevant at this scale. |
| **Hard delete with `ON DELETE CASCADE`**, not soft delete | Soft delete means every query needs a `deleted_at IS NULL` predicate, every unique constraint needs partial-index treatment, and forgetting one leaks deleted data. There is no audit, undo, or compliance requirement here that justifies that tax. Deleting a conversation removes its messages; deleting a user removes everything they own. |
| Deleting a document row also unlinks the file from disk | Best-effort. If the unlink fails the row is still deleted and the orphaned file is logged — a reconciliation job is the production answer, and is out of scope. |

---

## 3. Authentication

**Assumed: email + password, bcrypt-hashed, JWT access token delivered in an `httpOnly` cookie.**

- Passwords hashed with bcrypt (`passlib`). Minimum 8 characters, no composition rules —
  length beats forced symbols.
- The JWT is set as an `httpOnly`, `SameSite=Lax` cookie rather than returned to JS for
  `localStorage`. A token in `localStorage` is readable by any XSS payload; a cookie is
  not. It also means Next.js middleware and Server Components can see the session, which
  `localStorage` cannot offer.
- `Secure` is set when not running in local development.
- Access token TTL: **60 minutes**. There is **no refresh token and no rotation** —
  expiry means a redirect to `/login`. Refresh rotation done properly (reuse detection,
  a revocation store) is a meaningful chunk of work for a scope that doesn't need it.
- Because the token is a cookie, this is a **CSRF-relevant design**. `SameSite=Lax`
  blocks cross-site form posts, which is the mitigation I'm relying on. A double-submit
  CSRF token is the correct hardening and is listed as a known limitation rather than
  quietly ignored.
- Logout clears the cookie server-side. JWTs are stateless, so a stolen token stays valid
  until it expires — accepted, and noted as a limitation.
- **Not included:** email verification, password reset, OAuth/SSO, MFA, account lockout,
  login rate limiting.
- Registration is open — no invite codes, no admin approval.

---

## 4. Search

This was the most genuinely ambiguous requirement ("provide search functionality for
conversations — the implementation is your choice"), so the assumption is explicit:

**Assumed: search matches both the conversation title and the text of its messages, and
returns ranked conversations.**

Title-only search sounds like it satisfies the brief, but it doesn't satisfy a user:
titles are short, often auto-derived from the first message, and the thing people
actually remember is something that was *said* in the thread. Searching message content
is what makes the feature real.

Implementation:

- PostgreSQL full-text search — a `GENERATED ... STORED` `tsvector` column on
  `conversations.title` and one on `messages.content`, each with a GIN index.
- A query matches a conversation if it hits the title or any of its messages. Results are
  deduplicated to one row per conversation and ordered by `ts_rank`, with title matches
  weighted above message matches.
- Rejected `ILIKE '%q%'`: no index can serve a leading wildcard, so it degrades to a
  sequential scan, and it can't rank results. Rejected Elasticsearch: a second datastore
  to run, sync, and explain, for a dataset this size.
- **Assumed English content** — the `english` text search configuration is hardcoded.
  Multi-language search needs a per-row language column and is out of scope.
- Partial words are handled with prefix matching (`to_tsquery` with `:*`) so that typing
  "refun" finds "refund". Full fuzzy/typo tolerance (trigram similarity) is not included.
- This is **lexical, not semantic** search. `pgvector` on the same tables is the natural
  next step, and the schema doesn't need to change to accommodate it.
- **Document search is not implemented** — the brief asks for conversation search, and
  with no extracted text there is nothing meaningful to search inside a document beyond
  its filename.

---

## 5. Document upload

| Assumption | Detail |
|---|---|
| Allowed types | PDF, DOCX, TXT only, per the brief. |
| Size ceiling | **10 MB**, enforced server-side while streaming the upload. Exceeding it returns `413`. |
| Validation strategy | Extension **and** declared `Content-Type` **and** actual byte size are all checked. Rejecting on extension alone is trivially bypassed. |
| Known gap | I do **not** verify magic bytes, so a renamed file with a correct-looking MIME type would pass. Real content sniffing (`python-magic`) is the fix; it's an OS-level dependency I chose not to add. Listed as a limitation, not overlooked. |
| `status` column | Always `uploaded`. There is no worker, no queue, no background job — the enum exists to mark where one would attach. |
| Not included | Virus scanning, deduplication by checksum, versioning, thumbnails, text extraction, download endpoint. |
| Storage | Local filesystem. Not durable, not shared across instances — fine for a single-node dev deployment, wrong for production, and called out as such. |

---

## 6. API design

- REST over JSON, all routes under `/api/v1`. The prefix is there so a v2 is possible; no
  deprecation policy is defined.
- **Consistent error envelope:** `{ "detail": "...", "code": "MACHINE_READABLE_CODE" }`.
  A `RequestValidationError` handler reshapes FastAPI's default 422 body into the same
  envelope so clients only ever parse one error format.
- **Cross-user access returns `404`, never `403`.** A `403` confirms that the resource
  exists and belongs to someone else, which is an information leak across a tenant
  boundary. From an unauthorised caller's perspective the resource does not exist. `403`
  is reserved for cases where the caller is authenticated, the resource is theirs, and
  the *action* is forbidden — which does not currently arise.
- Ownership is enforced in the query (`WHERE user_id = :current_user`), not by fetching
  and then comparing in Python. A filter that's part of the query can't be forgotten by a
  later code path.
- **Pagination:** limit/offset, response shape `{ items, total, page, size }`. Offset
  pagination degrades on deep pages; at this scale it's the right trade for a simpler
  client. Cursor pagination is the upgrade path.
- **Messages are returned unpaginated**, assuming threads stay small. This is a real
  scaling flaw for a long conversation and is a listed limitation.
- All timestamps are UTC, serialised as ISO 8601. No user timezone preference — the
  frontend formats to the browser's locale.
- Request and response models are separate Pydantic schemas. A SQLAlchemy model is never
  returned directly from a route, so internal columns can't leak into a response by
  accident.

---

## 7. Frontend

- **All meaningful state is server state**, so there is no global store. React Query owns
  caching, invalidation, and request de-duplication; anything left is local `useState`.
  Redux or Zustand here would mostly be hand-written cache management.
- Server Components fetch initial data where the session cookie allows it; `"use client"`
  is used only for genuinely interactive subtrees.
- Route groups `(auth)` and `(dashboard)` separate the two shells. `middleware.ts`
  redirects unauthenticated requests to `/login` — a cheap cookie-presence check, not a
  signature verification. **The middleware is UX, not security**; the backend
  authoritatively rejects every unauthenticated request.
- Client-side validation with `zod` mirrors the backend's Pydantic rules. It is a
  convenience layer only — duplicated intentionally, and the server never trusts it.
- Tailwind + `shadcn/ui`. Component code lives in the repo rather than behind a component
  library dependency, which keeps it inspectable and restyleable.
- Responsive at 375 / 768 / 1440 px. The sidebar collapses to a drawer on mobile.
- **Light mode only.** No dark mode, no theming, no i18n.
- Basic accessibility: focus states, labelled inputs, keyboard-navigable dialogs. Not a
  full WCAG audit, and no screen reader testing was done.

---

## 8. Infrastructure & tooling

- **Docker Compose runs PostgreSQL** (16). The backend and frontend run as local dev
  servers rather than in containers — faster reload, and it keeps the setup story short.
  Containerising the apps is a deployment concern, not a review concern.
- **Alembic for all schema changes.** No `create_all()`, including in tests. The FTS
  columns and GIN indexes are hand-written in the migration, since `--autogenerate` does
  not emit `GENERATED ... STORED` columns or GIN index definitions.
- Async SQLAlchemy 2.0 with `asyncpg`, matched to FastAPI's async request handling.
- Configuration via environment variables through Pydantic `Settings`. `.env.example` is
  committed; `.env` is not.
- **Single environment.** No staging/production config split, no secret manager — the
  JWT signing key comes from the environment and would come from a managed secret store
  in production.
- Tests run against a **separate database**, with each test in a transaction that rolls
  back, so tests don't depend on each other's ordering.
- **No CI pipeline, no rate limiting, no structured logging, no metrics or tracing, no
  error reporting.** All deliberate scope cuts, all listed in the engineering report.

---

## 9. Explicitly out of scope

Named here so that their absence reads as a decision rather than an oversight:

| Not built | Why |
|---|---|
| Real AI / LLM integration | The brief excludes it. |
| Document text extraction, embeddings, RAG | Same — the `status` enum marks the hook. |
| Refresh token rotation | Meaningful complexity; single access token is sufficient at this scope. |
| Organisations, teams, sharing, RBAC | No multi-user requirement in the brief. |
| Real-time updates (WebSocket / SSE) | Nothing in the app is collaborative or live. |
| Object storage (S3) | Local disk, behind an abstraction that makes the swap small. |
| Background workers (Celery / Redis) | Nothing needs to run asynchronously. The brief warns against over-engineering. |
| Soft delete / audit log | No compliance or undo requirement. |
| Rate limiting, CSRF tokens, virus scanning | Real production needs, out of scope here — all listed as known limitations. |
| Full test coverage | A focused suite covering auth, CRUD, ownership isolation, upload validation, and search. Coverage percentage is not the goal. |

---

## 10. Where I think this is weakest

Stating this plainly, since it's likely to come up:

1. **No magic-byte validation on uploads.** The strongest remaining hole in the input
   validation story.
2. **Unpaginated messages.** Correct at demo scale, wrong at real scale, and a
   straightforward fix.
3. **No CSRF token.** `SameSite=Lax` is a real mitigation but not a complete one for a
   cookie-based session.
4. **Local file storage.** Breaks the moment there is more than one backend instance.
5. **Hardcoded `english` FTS configuration.** Fine for the assessment, wrong for any
   multi-language user base.
