/**
 * Mirrors the backend's Pydantic schemas (`backend/app/schemas/`).
 *
 * Hand-written rather than generated from the OpenAPI document: the surface is
 * small, and a generated client would be another thing in the repo I did not
 * write. The trade-off is that these can drift — `docs/api.md` is the contract
 * both sides are checked against.
 *
 * All timestamps are ISO-8601 UTC strings, formatted at the point of display.
 */

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

/**
 * Login deliberately returns no token — the JWT arrives only as an httpOnly
 * cookie (Decision 1). Nothing here is worth destructuring; the meaningful
 * result of a login is the `Set-Cookie` header.
 */
export interface LoginResponse {
  message: string;
}

// ── Conversations ────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  user_id: string;
  org_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedConversations {
  items: Conversation[];
  total: number;
  page: number;
  size: number;
}

// ── Messages ─────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// ── Documents ────────────────────────────────────────────────────────────────

/**
 * Every upload is `uploaded` today. The other states exist so an indexing
 * pipeline could be added without a schema change — see ASSUMPTIONS.md.
 */
export type DocumentStatus = "uploaded" | "processing" | "indexed" | "failed";

export interface Document {
  id: string;
  user_id: string;
  org_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  status: DocumentStatus;
  uploaded_at: string;
}

// ── Organisations ────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export type OrgRole = "member" | "admin";

export interface Membership {
  user_id: string;
  org_id: string;
  role: OrgRole;
  joined_at: string;
}

/** 201 response from POST /organizations */
export interface OrganizationCreated {
  organization: Organization;
  membership: Membership;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  user: User;
  current_org: Organization;
  total_conversations: number;
  total_documents: number;
  total_messages: number;
  recent_conversations: Conversation[];
  recent_documents: Document[];
}

// ── Errors ───────────────────────────────────────────────────────────────────

/**
 * The codes the backend can return, from the table in `docs/api.md`.
 *
 * The union is widened with `(string & {})` on purpose: a backend that adds a
 * code should not be a type error here, but the known values still autocomplete.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_REGISTERED"
  | "CONVERSATION_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "ORGANIZATION_NOT_FOUND"
  | "ALREADY_MEMBER"
  | "ORG_REQUIRED"
  | "FILE_TYPE_NOT_ALLOWED"
  | "FILE_TYPE_MISMATCH"
  | "FILE_TOO_LARGE"
  | "FILE_EMPTY"
  | "FILENAME_REQUIRED"
  | "USER_NOT_FOUND"
  | "INTERNAL_ERROR"
  | (string & {});

export interface ValidationErrorItem {
  field: string;
  message: string;
}

/** Every failure from the API has this shape — see `backend/app/core/errors.py`. */
export interface ApiErrorBody {
  detail: string;
  code: ApiErrorCode;
  /** Present only on 422 responses. */
  errors?: ValidationErrorItem[];
}
