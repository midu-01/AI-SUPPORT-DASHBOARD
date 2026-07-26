# API Documentation

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs` (Swagger UI) — every endpoint below
documents its failure responses there too, not just the success shape.

**Authentication.** `POST /auth/login` sets an `httpOnly`, `SameSite=Lax` cookie named
`access_token`. Browsers send it automatically; the token is never in a response body.
All endpoints marked ✅ return `401 UNAUTHENTICATED` without it.

**Ownership.** Requesting another user's resource returns **404, not 403** — a 403 would
confirm the id exists. So `404` on a valid-looking id means "not yours or not there", and
the two are indistinguishable by design.

---

## Auth

| Method | Endpoint | Auth | Request Body | Success | Errors |
|--------|----------|------|--------------|---------|--------|
| POST | `/auth/register` | ❌ | `{ email, password, full_name }` | 201 | 409 `EMAIL_ALREADY_REGISTERED`, 422 |
| POST | `/auth/login` | ❌ | `{ email, password }` | 200 + sets cookie | 401 `INVALID_CREDENTIALS`, 422 |
| GET | `/auth/me` | ✅ | — | 200 | 401 |
| POST | `/auth/logout` | ❌ | — | 200 clears cookie | — |

**Validation rules.** `email` must be a valid address; `password` is 8–72 characters (72 is
bcrypt's limit, so longer input is rejected rather than silently truncated); `full_name` is
1–255 characters. Login applies **no** length rules — enforcing them there would reject
existing passwords and advertise the policy.

`/auth/logout` needs no auth: clearing an absent cookie is a harmless no-op.

---

## Conversations

| Method | Endpoint | Auth | Notes | Success | Errors |
|--------|----------|------|-------|---------|--------|
| POST | `/conversations` | ✅ | `{ title }` — trimmed; blank rejected | 201 | 401, 422 |
| GET | `/conversations?q=&page=&size=` | ✅ | Search + pagination | 200 | 401, 422 |
| GET | `/conversations/{id}` | ✅ | Ownership enforced | 200 | 401, 404 |
| PATCH | `/conversations/{id}` | ✅ | `{ title }` | 200 | 401, 404, 422 |
| DELETE | `/conversations/{id}` | ✅ | Cascades to messages | 204 | 401, 404 |

**Query parameters.** `q` searches conversation titles **and** message text, returning
matching conversations (wildcards in `q` are matched literally). `page` ≥ 1 (default 1),
`size` 1–100 (default 20); out-of-range values are `422`. A page past the end returns an
empty `items` array with the true `total`, not an error.

Response shape: `{ items, total, page, size }`.

---

## Messages

| Method | Endpoint | Auth | Notes | Success | Errors |
|--------|----------|------|-------|---------|--------|
| GET | `/conversations/{id}/messages` | ✅ | Ordered by `created_at` ASC, not paginated | 200 | 401, 404 |
| POST | `/conversations/{id}/messages` | ✅ | `{ content, role }` | 201 | 401, 404, 422 |

`role` is `user` or `assistant` and defaults to `user`; any other value is `422`, and the
database enforces the same set with a `CHECK` constraint. Posting a message also bumps the
parent conversation's `updated_at`, which is what makes it rise in "recent conversations".

---

## Documents

| Method | Endpoint | Auth | Notes | Success | Errors |
|--------|----------|------|-------|---------|--------|
| POST | `/documents` | ✅ | `multipart/form-data`, max 10 MB, PDF/DOCX/TXT | 201 | 400 `FILE_TYPE_NOT_ALLOWED` / `FILE_EMPTY` / `FILENAME_REQUIRED`, 401, 413 `FILE_TOO_LARGE` |
| GET | `/documents` | ✅ | Ordered by `uploaded_at` DESC | 200 | 401 |
| DELETE | `/documents/{id}` | ✅ | Removes row, then file from disk | 204 | 401, 404 |

The size limit is enforced **while streaming**, so an oversized upload is rejected without
being held in memory, and the partial write is deleted. The stored filename is generated
server-side (a UUID plus an extension chosen from the MIME type), so a hostile filename
cannot influence the path; the client's name is kept only as `original_filename`.

`status` is always `uploaded` — there is no processing pipeline. It exists so one could be
added without a schema change.

> **Known limitation:** the type check trusts the client's `Content-Type` header, which is
> spoofable. Real validation would sniff the file's magic bytes.

---

## Dashboard

| Method | Endpoint | Auth | Notes | Success | Errors |
|--------|----------|------|-------|---------|--------|
| GET | `/dashboard/summary` | ✅ | Everything the dashboard needs, in one request | 200 | 401 |

Returns `{ user, total_conversations, total_documents, total_messages,
recent_conversations, recent_documents }` — the last two capped at 5, ordered by
`updated_at` and `uploaded_at` descending. One call rather than four, so the dashboard has
no client-side request waterfall. All counts are scoped to the authenticated user.

---

## Error Envelope

All errors return a consistent JSON body — including validation failures and
unhandled exceptions, via global handlers in `app/core/errors.py`:

```json
{
  "detail": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

`detail` is for humans; `code` is for the frontend, which should never have to
match on English prose to decide what to render.

Validation failures (422) add a flattened `errors` array, so a form can map each
problem straight onto a field:

```json
{
  "detail": "Invalid request",
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "email", "message": "value is not a valid email address" },
    { "field": "password", "message": "String should have at least 8 characters" }
  ]
}
```

### Codes

| Code | Status | Raised when |
|------|--------|-------------|
| `VALIDATION_ERROR` | 422 | Request body or query parameters failed validation |
| `UNAUTHENTICATED` | 401 | Missing, forged, or expired auth cookie |
| `INVALID_CREDENTIALS` | 401 | Wrong password **or** unknown email — deliberately identical |
| `EMAIL_ALREADY_REGISTERED` | 409 | Email is taken (also covers the concurrent-signup race) |
| `CONVERSATION_NOT_FOUND` | 404 | Missing **or** owned by another user |
| `DOCUMENT_NOT_FOUND` | 404 | Missing **or** owned by another user |
| `FILE_TYPE_NOT_ALLOWED` | 400 | MIME type outside PDF / DOCX / TXT |
| `FILE_TOO_LARGE` | 413 | Upload exceeded 10 MB (detected mid-stream) |
| `FILE_EMPTY` | 400 | Upload contained no bytes |
| `FILENAME_REQUIRED` | 400 | Multipart part carried no filename |
| `INTERNAL_ERROR` | 500 | Unhandled exception; details go to the logs, never the client |

Common HTTP status codes used:

| Code | Meaning |
|------|---------|
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Bad request (e.g. invalid file type) |
| 401 | Unauthenticated |
| 404 | Not found (also used for ownership violations) |
| 409 | Conflict (e.g. duplicate email) |
| 413 | Payload too large |
| 422 | Validation error |
