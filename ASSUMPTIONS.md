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
| Users | Each user only ever sees their own data. No teams, organisations, roles, or sharing. |
| Conversations | A conversation is a titled thread of messages owned by one user. |
| Messages | Can be created and read, but not edited or deleted — the brief asks for conversation CRUD, not message CRUD. |
| Auth | Email + password (bcrypt), JWT delivered in an `httpOnly` cookie. No refresh token, email verification, password reset, or OAuth. |
| Deletes | Hard delete with `ON DELETE CASCADE`. No soft delete — there is no undo or audit requirement here, and it would add a `deleted_at` filter to every query. |
| Search | Matches conversation titles and message text, and returns the matching conversations. |
| Uploads | PDF, DOCX, TXT only, 10 MB maximum, enforced on the server while streaming. The upload UI is not built yet; when it lands it will pre-check type and size for faster feedback, but the server validates independently and never trusts the client. |
| Document status | Always `uploaded` — there is no background processing pipeline. |
| Ownership errors | Requesting another user's resource returns `404`, not `403`. A `403` would confirm that the resource exists. |
| Timestamps | Stored in UTC; the frontend formats them for display. No timezone setting. |
| UI | Light mode only, English only, no dark mode and no i18n. |
| Database | PostgreSQL running locally (see README). Alembic owns every schema change. |

## Out of scope

Real AI/LLM calls, document text extraction, embeddings and RAG, teams and permissions,
real-time updates, S3 storage, background workers, rate limiting, soft delete and audit
logging, and exhaustive test coverage. Tests focus on auth, conversation CRUD, ownership
isolation, and upload validation.

Known limitations and what I would improve are covered in `ENGINEERING_REPORT.md`.
