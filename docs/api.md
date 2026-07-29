# API Documentation

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

---

## Active Organisation Header

All endpoints that are scoped to an organisation require the `X-Org-ID` header:

```
X-Org-ID: <org-uuid>
```

The backend verifies on every request that the authenticated user is a member of the
specified org. A missing header returns `400 ORG_REQUIRED`. An org the user doesn't
belong to returns `404 ORGANIZATION_NOT_FOUND` — never `403`, which would confirm the
org exists.

Endpoints marked **org-scoped** in the tables below require this header.

---

## Auth

| Method | Endpoint | Auth | Request Body | Success | Error |
|--------|----------|------|--------------|---------|-------|
| POST | `/auth/register` | ❌ | `{ email, password, full_name }` | 201 | 409 duplicate |
| POST | `/auth/login` | ❌ | `{ email, password }` | 200 + sets cookie | 401 |
| GET | `/auth/me` | ✅ | — | 200 | 401 |
| POST | `/auth/logout` | ✅ | — | 200 clears cookie | — |

---

## Organisations

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| POST | `/organizations` | ✅ | `{ name }` — creator auto-added as admin | 201 `{ organization, membership }` | 422 |
| GET | `/organizations` | ✅ | Lists orgs the caller belongs to | 200 `Organization[]` | — |
| POST | `/organizations/{org_id}/members` | ✅ admin only | `{ user_id, role }` — role: `member` \| `admin` | 201 `Membership` | 403, 404, 409 |
| GET | `/organizations/{org_id}/members` | ✅ member | Lists all members with user details | 200 `MemberDetail[]` | 404 |
| POST | `/organizations/{org_id}/members/invite` | ✅ admin only | `{ email, role }` — invites user by email | 201 `Membership` | 403, 404, 409 |

### Response shapes

```jsonc
// Organization
{ "id": "uuid", "name": "Acme", "created_at": "2026-07-28T..." }

// Membership
{ "user_id": "uuid", "org_id": "uuid", "role": "admin", "joined_at": "2026-07-28T..." }

// OrganizationCreated (POST /organizations response)
{ "organization": { ...Organization }, "membership": { ...Membership } }
```

---

## Conversations

> **org-scoped** — requires `X-Org-ID` header.

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| POST | `/conversations` | ✅ | `{ title }` | 201 | 400, 422 |
| GET | `/conversations?q=&page=&size=` | ✅ | Search + pagination, scoped to active org | 200 | 400 |
| GET | `/conversations/{id}` | ✅ | Ownership + org enforced | 200 | 400, 404 |
| PATCH | `/conversations/{id}` | ✅ | `{ title }` | 200 | 400, 404, 422 |
| DELETE | `/conversations/{id}` | ✅ | Cascades messages | 204 | 400, 404 |

---

## Messages

> **org-scoped** — requires `X-Org-ID` header.

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| GET | `/conversations/{id}/messages` | ✅ | Ordered by `created_at` ASC | 200 | 400, 404 |
| POST | `/conversations/{id}/messages` | ✅ | `{ content, role }` | 201 | 400, 404, 422 |

---

## Documents

> **org-scoped** — requires `X-Org-ID` header.

| Method | Endpoint | Auth | Notes | Success | Error |
|--------|----------|------|-------|---------|-------|
| POST | `/documents` | ✅ | `multipart/form-data`, max 10 MB, PDF/DOCX/TXT | 201 | 400 type, 400 missing header, 413 size |
| GET | `/documents` | ✅ | Ordered by `uploaded_at` DESC, scoped to active org | 200 | 400 |
| DELETE | `/documents/{id}` | ✅ | Removes file from disk | 204 | 400, 404 |

---

## Dashboard

> **org-scoped** — requires `X-Org-ID` header.

| Method | Endpoint | Auth | Notes | Success |
|--------|----------|------|-------|---------|
| GET | `/dashboard/summary` | ✅ | Counts + last 5 conversations + last 5 documents, all scoped to active org | 200 |

### Response shape

```jsonc
{
  "user": { ...UserRead },
  "current_org": { ...Organization },
  "total_conversations": 12,
  "total_documents": 4,
  "total_messages": 87,
  "recent_conversations": [ ...Conversation[] ],
  "recent_documents": [ ...Document[] ]
}
```

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
| 400 | Bad request (e.g. invalid file type, missing `X-Org-ID`) |
| 401 | Unauthenticated |
| 403 | Forbidden (e.g. non-admin attempting to invite members) |
| 404 | Not found (also used for ownership violations and non-member org access) |
| 409 | Conflict (e.g. duplicate email, user already a member) |
| 413 | Payload too large |
| 422 | Validation error |

## Machine-readable error codes

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHENTICATED` | 401 | Missing or invalid JWT cookie |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `EMAIL_ALREADY_REGISTERED` | 409 | Registration with a duplicate email |
| `CONVERSATION_NOT_FOUND` | 404 | Conversation missing, wrong user, or wrong org |
| `DOCUMENT_NOT_FOUND` | 404 | Document missing, wrong user, or wrong org |
| `ORGANIZATION_NOT_FOUND` | 404 | Org missing or caller is not a member |
| `ALREADY_MEMBER` | 409 | User is already a member of the org |
| `ORG_REQUIRED` | 400 | `X-Org-ID` header is missing |
| `FILE_TYPE_NOT_ALLOWED` | 400 | Upload MIME type is not PDF, DOCX, or TXT |
| `FILE_TYPE_MISMATCH` | 400 | File content does not match the declared MIME type (magic byte check) |
| `FILE_TOO_LARGE` | 413 | Upload exceeds 10 MB |
| `FILE_EMPTY` | 400 | Upload has zero bytes |
| `FILENAME_REQUIRED` | 400 | Multipart part has no filename |
| `USER_NOT_FOUND` | 404 | Target user does not exist (e.g. when adding a member) |
| `VALIDATION_ERROR` | 422 | Pydantic validation failed; `errors` array present |
| `INTERNAL_ERROR` | 500 | Unhandled exception (traceback logged, not returned) |
