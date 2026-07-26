import { cookies } from "next/headers";

import { ApiError, apiFetch } from "./api-client";
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

  return apiFetch<T>(path, {
    ...options,
    headers: { ...options.headers, cookie: cookieHeader },
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
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await serverApiFetch<User>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      return null;
    }
    throw error;
  }
}
