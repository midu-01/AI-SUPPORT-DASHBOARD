# Assumptions

The brief allowed up to two clarification questions. I chose to document my assumptions
instead, since each open point had a reasonable default.

## The two questions I answered myself

**Are real AI/LLM replies expected in conversations?**
No. I read "AI-ready" as a requirement on the *data model*, not on behaviour — the brief
says AI processing is not required. So no LLM is called anywhere. Instead, `messages.role`
(`user` / `assistant`) and `documents.status` (`uploaded` / `processing` / `indexed` /
`failed`) exist so an AI layer could be added later without changing the schema.

**Is the uploaded file stored, or only a metadata row?**
The file is saved to a local `uploads/` folder and the database stores only metadata. I
kept the file because size and type validation is only real if the upload is actually
read. `documents.storage_path` is the one place that would change if this moved to S3.

## Scope decisions

| Area | Assumption |
|---|---|
| Users | Each user only ever sees their own data within their active organisation. |
| Conversations | A conversation is a titled thread of messages owned by one user and scoped to one organisation. |
| Messages | Can be created and read, but not edited or deleted — the brief asks for conversation CRUD, not message CRUD. |
| Auth | Email + password (bcrypt), JWT delivered in an `httpOnly` cookie. No refresh token, email verification, password reset, or OAuth. |
| Deletes | Hard delete with `ON DELETE CASCADE`. No soft delete — there is no undo or audit requirement here, and it would add a `deleted_at` filter to every query. |
| Search | Matches conversation titles and message text, scoped to the active organisation. |
| Uploads | PDF, DOCX, TXT only, 10 MB maximum, enforced on the server while streaming. The UI pre-checks type and size for faster feedback, but that is a courtesy — the server validates independently and never trusts the client. |
| Document status | Always `uploaded` — there is no background processing pipeline. |
| Ownership errors | Requesting another user's resource, or a resource from an org the user doesn't belong to, returns `404`, not `403`. A `403` would confirm that the resource exists. |
| Timestamps | Stored in UTC; the frontend formats them for display with a pinned `en-GB` locale, so server and client render identically. No timezone setting. |
| UI | Light mode only, English only, no dark mode and no i18n. |
| Database | PostgreSQL running locally (see README). Alembic owns every schema change. |

## Multi-organisation scope decisions

| Area | Assumption |
|---|---|
| Active-org transport | `X-Org-ID` request header. Chosen over a JWT claim (requires re-login to switch) and a separate cookie (implicit, awkward in SSR). The header is stateless, explicit, and carries no CSRF risk. |
| Org membership model | Join table (`user_organizations`) with a `role` column (`member` / `admin`). Covers both simple membership checks and admin-only operations without a schema change. |
| `org_id` migration | The first organisation migration adds nullable columns. The follow-up assigns legacy resources to the user's earliest membership, creates a default admin workspace only when that user has no membership, then sets both columns `NOT NULL`. |
| Org creation | Any authenticated user can create an organisation and is automatically added as its admin. |
| Member invitation | `POST /api/v1/organizations/{org_id}/members/invite` allows admins to invite members by email. A dedicated `/members` screen is available on the frontend. |
| Org deletion | Not implemented. Deleting an org would cascade-delete all its conversations and documents, which is a destructive operation that warrants a separate, deliberate design decision. |
| Dashboard | All five summary queries (counts + recent lists) are scoped to the active org. The response includes `current_org` so the frontend knows which org the numbers belong to. |

## Out of scope

Real AI/LLM calls, document text extraction, embeddings and RAG, real-time updates,
S3 storage, background workers, rate limiting, soft delete and audit logging, exhaustive
test coverage, org deletion, and pending invitation/email acceptance flow.

Known limitations and what I would improve are covered in `ENGINEERING_REPORT.md`.
