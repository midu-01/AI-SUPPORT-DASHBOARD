/**
 * Backend base URL.
 *
 * `NEXT_PUBLIC_` because the browser calls the API directly — the cookie set by
 * FastAPI is what authenticates those calls, so there is no secret here to
 * protect. Anything genuinely secret must never carry this prefix: the value is
 * inlined into the client bundle at build time.
 *
 * The fallback keeps a fresh clone runnable without a `.env.local`, which is
 * the setup step reviewers most often skip.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
