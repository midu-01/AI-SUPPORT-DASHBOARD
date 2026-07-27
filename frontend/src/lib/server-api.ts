import { cookies } from "next/headers";
import { cache } from "react";

import { ApiError, apiFetch } from "./api-client";
import { ORG_COOKIE } from "./org-context";
import type { User } from "@/types/api";

/**
 * Server-side counterpart to `apiFetch`.
 *
 * A Server Component runs in Node, not the browser, so there is no cookie jar
 * for `credentials: "include"` to draw on — the incoming request's cookies have
 * to be forwarded by hand. Without this, every server-rendered fetch returns a
 * 401 while the identical call from the browser succeeds, which is a genuinely
 * confusing way to spend an afternoon.
 *
 * `X-Org-ID` is forwarded from the `activeOrgId` cookie written by `OrgProvider`
 * whenever the user selects an org.  The cookie is plain (non-httpOnly) so the
 * server can read it here.  The backend validates membership on every request
 * regardless, so the cookie carries no privilege — it is just a routing hint.
 *
 * Importing `next/headers` also pins this module to the server: a Client
 * Component that imports it fails at build time rather than at runtime.
 */
export async function serverApiFetch<T>(
  path: string,
  options: Parameters<typeof apiFetch>[1] = {},
): Promise<T> {
  // `cookies()` is async as of Next.js 16 — synchronous access was removed.
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  // Forward the active org id as X-Org-ID so Server Components (dashboard,
  // conversation detail) are scoped to the same org the client has selected.
  const activeOrgId = cookieStore.get(ORG_COOKIE)?.value;

  // Build the merged header object explicitly so TypeScript can verify the
  // shape.  Spreading `options.headers` (HeadersInit | undefined) into an
  // object literal produces a union that is not assignable back to HeadersInit,
  // so we use the Headers constructor to normalise it first.
  const merged = new Headers(options.headers as HeadersInit | undefined);
  merged.set("cookie", cookieHeader);
  if (activeOrgId) {
    merged.set("X-Org-ID", activeOrgId);
  }

  return apiFetch<T>(path, {
    ...options,
    headers: merged,
    // Per-user data must never be cached and handed to the next visitor.
    cache: "no-store",
  });
}

/**
 * The signed-in user, or `null` when the cookie is missing, expired, or forged.
 *
 * Only 401 becomes `null`. A 500 is re-thrown so a backend outage surfaces as an
 * error page instead of silently masquerading as "logged out" and bouncing the
 * user to /login with no explanation.
 *
 * Wrapped in React's `cache` so that a layout and the page inside it can both
 * ask "who is signed in?" without producing two `/auth/me` round-trips. The
 * cache lives for exactly one server render, so it dedupes without ever holding
 * one request's user across another's.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    return await serverApiFetch<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      return null;
    }
    throw error;
  }
});

