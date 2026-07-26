# API Documentation

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

---

## Auth

| Method | Endpoint | Auth | Request Body | Success | Error |
|--------|----------|------|--------------|---------|-------|
| POST | `/auth/register` | ❌ | `{ email, password, full_name }` | 201 | 409 duplicate |
| POST | `/auth/login` | ❌ | `{ email, password }` | 200 + sets cookie | 401 |
| GET | `/auth/me` | ✅ | — | 200 | 401 |
| POST | `/auth/logout` | ✅ | — | 200 clears cookie | — |

---

## Conversations

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| POST | `/conversations` | ✅ | `{ title }` | 201 | 422 |
| GET | `/conversations?q=&page=&size=` | ✅ | Search + pagination | 200 | — |
| GET | `/conversations/{id}` | ✅ | Ownership enforced | 200 | 404 |
| PATCH | `/conversations/{id}` | ✅ | `{ title }` | 200 | 404, 422 |
| DELETE | `/conversations/{id}` | ✅ | Cascades messages | 204 | 404 |

---

## Messages

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| GET | `/conversations/{id}/messages` | ✅ | Ordered by `created_at` ASC | 200 | 404 |
| POST | `/conversations/{id}/messages` | ✅ | `{ content, role }` | 201 | 404, 422 |

---

## Documents

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| POST | `/documents` | ✅ | `multipart/form-data`, max 10 MB, PDF/DOCX/TXT | 201 | 400 type, 413 size |
| GET | `/documents` | ✅ | Ordered by `uploaded_at` DESC | 200 | — |
| DELETE | `/documents/{id}` | ✅ | Removes file from disk | 204 | 404 |

---

## Dashboard

| Method | Endpoint | Auth | Notes | Success |
|--------|----------|------|-------|---------|
| GET | `/dashboard/summary` | ✅ | Counts + last 5 conversations + last 5 documents | 200 |

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
