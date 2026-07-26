import { API_BASE_URL } from "./config";
import type { ApiErrorBody, ApiErrorCode, ValidationErrorItem } from "@/types/api";

/**
 * A failed API call, carrying the backend's machine-readable `code`.
 *
 * Callers branch on `code`, never on `message`. The backend documents `detail`
 * as human-facing prose, which means it is free to change wording without
 * warning — matching on it would make the UI break on a copy edit.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  /** Populated only for 422s, one entry per rejected field. */
  readonly fieldErrors: ValidationErrorItem[];

  constructor(
    status: number,
    code: ApiErrorCode,
    detail: string,
    fieldErrors: ValidationErrorItem[] = [],
  ) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** True when the user is not (or no longer) signed in. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  /** Serialised as JSON, unless it is already a `FormData`. */
  body?: unknown;
};

/**
 * Typed wrapper around `fetch` for the FastAPI backend.
 *
 * Two things it centralises:
 *
 * 1. `credentials: "include"`. The JWT lives in an httpOnly cookie, so the
 *    browser must be told to attach it — cross-origin `fetch` omits cookies by
 *    default, and forgetting this produces a silent 401 on every call.
 * 2. Error translation. Every backend failure is `{ detail, code }`, so it is
 *    unwrapped once here into an `ApiError` rather than at each call site.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  // FormData must keep the browser's generated multipart boundary, so its
  // Content-Type is deliberately left unset — setting it by hand corrupts the
  // upload. Only JSON bodies get an explicit type.
  const isFormData = body instanceof FormData;
  const resolvedHeaders = new Headers(headers);
  if (body !== undefined && !isFormData) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: resolvedHeaders,
    credentials: "include",
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  // 204 (delete) and any genuinely empty body would throw on .json().
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Rebuild an `ApiError` from a failed response.
 *
 * The body is not assumed to be the documented envelope: a crash in a proxy, or
 * a gateway timeout, returns HTML. Falling back keeps those surfacing as a
 * normal error rather than a `SyntaxError` from `.json()` that hides the real
 * status.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let payload: Partial<ApiErrorBody> = {};
  try {
    payload = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    // Non-JSON body — fall through to the generic message below.
  }

  return new ApiError(
    response.status,
    payload.code ?? "UNKNOWN_ERROR",
    payload.detail ?? `Request failed with status ${response.status}`,
    payload.errors ?? [],
  );
}
