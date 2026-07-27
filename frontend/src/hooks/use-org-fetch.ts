"use client";

import { useCallback } from "react";

import { apiFetch } from "@/lib/api-client";
import { useOrg } from "@/lib/org-context";

/**
 * Returns an `apiFetch` wrapper that automatically injects the `X-Org-ID`
 * header from the active organisation context.
 *
 * **Why a hook rather than modifying `apiFetch` directly?**
 *
 * `apiFetch` is a plain async function — it has no access to React context.
 * Injecting the header there would require passing `orgId` as an argument to
 * every call site, which is exactly the boilerplate this hook eliminates.
 *
 * The hook reads `orgId` from `OrgContext` once per render and closes over it
 * in the returned function, so every call made during that render uses the
 * same org id.  When the user switches orgs, `OrgProvider` clears the React
 * Query cache, all queries re-run, and the new `orgId` is picked up on the
 * next render.
 *
 * **Usage:**
 * ```ts
 * const orgFetch = useOrgFetch();
 * const data = await orgFetch<MyType>("/conversations");
 * ```
 *
 * The returned function has the same signature as `apiFetch` and can be used
 * as a drop-in replacement in `queryFn` and `mutationFn` callbacks.
 */
export function useOrgFetch() {
  const { orgId } = useOrg();

  return useCallback(
    <T>(path: string, options: Parameters<typeof apiFetch>[1] = {}): Promise<T> => {
      const { headers, ...rest } = options;

      // Build the merged headers.  `Headers` normalises casing, so
      // "X-Org-ID" and "x-org-id" are the same key — no risk of duplicates.
      const merged = new Headers(headers as HeadersInit | undefined);
      if (orgId) {
        merged.set("X-Org-ID", orgId);
      }

      return apiFetch<T>(path, { ...rest, headers: merged });
    },
    [orgId],
  );
}
