"use client";

/**
 * Active-organisation context.
 *
 * Responsibilities:
 *  1. Fetch the user's org list once on mount via React Query.
 *  2. Persist the active org id in localStorage (survives page refresh) AND
 *     in a plain cookie (readable by Next.js Server Components via
 *     `serverApiFetch`, which forwards it as the `X-Org-ID` header).
 *  3. Expose `activeOrg`, `orgs`, `setActiveOrg`, and `orgId` to any client
 *     component that needs them.
 *
 * Why context rather than a global React Query key?
 * The active org is *UI state*, not server state — the server does not know
 * which org is "active"; it only knows which org the request is scoped to via
 * the X-Org-ID header.  Keeping it in context (backed by localStorage + cookie)
 * is the right layer: it is client-only, survives navigation, and is cleared on
 * logout by the Topbar's `queryClient.clear()` call.
 *
 * Cookie vs. localStorage for SSR:
 * localStorage is not readable on the server.  A plain (non-httpOnly) cookie
 * IS forwarded with every request, so `serverApiFetch` can read it and include
 * it as `X-Org-ID` without any client round-trip.  The cookie carries no secret
 * — it is just an org UUID that the backend validates against the user's
 * membership on every request anyway.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./api-client";
import type { Organization } from "@/types/api";

const LS_KEY = "activeOrgId";
/** Cookie name read by serverApiFetch to forward as X-Org-ID. */
export const ORG_COOKIE = "activeOrgId";

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeOrgCookie(orgId: string | null): void {
  if (typeof document === "undefined") return;
  if (orgId) {
    // SameSite=Lax: sent on same-site navigations and top-level cross-site GETs,
    // but not on cross-site sub-resource requests — sufficient for our use case.
    // No `httpOnly`: the cookie must be readable by JS (OrgProvider) and by the
    // Next.js server (serverApiFetch).  It carries no secret — the backend
    // validates membership on every request regardless.
    document.cookie = `${ORG_COOKIE}=${orgId}; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${ORG_COOKIE}=; path=/; max-age=0`;
  }
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface OrgContextValue {
  /** The currently selected organisation, or `null` while loading / if the user
   *  has no orgs yet. */
  activeOrg: Organization | null;
  /** Convenience shorthand — `activeOrg?.id ?? null`. */
  orgId: string | null;
  /** All orgs the user belongs to. */
  orgs: Organization[];
  /** Switch the active org.  Clears the entire React Query cache so every
   *  scoped query re-fetches against the new org. */
  setActiveOrg: (org: Organization) => void;
  /** True while the org list is being fetched for the first time. */
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function OrgProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Restore the last-used org id from localStorage on first render.
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_KEY);
  });

  const { data: orgs = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: () => apiFetch<Organization[]>("/organizations"),
    // Orgs change rarely — a 60-second stale time avoids re-fetching on every
    // navigation while still picking up a newly-created org quickly.
    staleTime: 60_000,
  });

  // Once the org list arrives, resolve the active org:
  //  - If the stored id is still in the list, keep it.
  //  - Otherwise fall back to the first org (handles the case where the user
  //    was removed from their previously-active org).
  //
  // The resolved id is derived synchronously from state + query data so that
  // React never renders a stale org.
  const resolvedOrgId = (() => {
    if (orgs.length === 0) return activeOrgId;
    if (orgs.find((o) => o.id === activeOrgId)) return activeOrgId;
    return orgs[0].id;
  })();

  // When the fallback kicks in (stored id not in the list), sync state and
  // external stores so everything agrees on the same org id.  The guard
  // `resolvedOrgId !== activeOrgId` ensures this only fires when the derived
  // value actually differs from the explicit choice — not on every render.
  useEffect(() => {
    if (orgs.length === 0 || !resolvedOrgId) return;
    if (resolvedOrgId !== activeOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveOrgId(resolvedOrgId);
      // Only the fallback path writes here. Explicit user choices are persisted
      // synchronously in setActiveOrg; rewriting on every effect could let a
      // stale pre-switch render overwrite that newer choice during refresh.
      localStorage.setItem(LS_KEY, resolvedOrgId);
      writeOrgCookie(resolvedOrgId);
    }
  }, [orgs, resolvedOrgId, activeOrgId]);

  const activeOrg = orgs.find((o) => o.id === resolvedOrgId) ?? null;

  const setActiveOrg = useCallback(
    (org: Organization) => {
      setActiveOrgId(org.id);
      localStorage.setItem(LS_KEY, org.id);
      writeOrgCookie(org.id);
      // Remove organization-scoped data while retaining the organization list.
      // Clearing that list too creates a transient `orgs.length === 0` render,
      // which can race with selection persistence and restore the old fallback.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "organizations",
      });
      // Client views use org-keyed React Query caches and re-render immediately.
      // Server-rendered detail routes read this cookie on their next navigation.
    },
    [queryClient],
  );

  return (
    <OrgContext.Provider
      value={{
        activeOrg,
        orgId: activeOrg?.id ?? null,
        orgs,
        setActiveOrg,
        isLoading,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access the active-org context from any client component.
 *
 * Throws if called outside `<OrgProvider>` — a missing provider is a
 * programming error, not a runtime condition, so an early throw is better than
 * a silent `null` that surfaces as a confusing downstream error.
 */
export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used inside <OrgProvider>");
  }
  return ctx;
}
