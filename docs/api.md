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

## Health

| Method | Endpoint | Auth | Notes | Success |
|--------|----------|------|-------|---------|
| GET | `/health` | ❌ | Liveness probe. **Not** under the `/api/v1` prefix — it answers about the process, not the API version | 200 `{ "status": "ok" }` |

---

## Error Envelope

All errors return a consistent JSON body:

```json
{
  "detail": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

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
