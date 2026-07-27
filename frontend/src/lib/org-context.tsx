"use client";

/**
 * Active-organisation context.
 *
 * Responsibilities:
 *  1. Fetch the user's org list once on mount via React Query.
 *  2. Persist the active org id in localStorage so a page refresh keeps the
 *     selection — the user should not have to re-pick their org every time.
 *  3. Expose `activeOrg`, `orgs`, and `setActiveOrg` to any client component
 *     that needs them.
 *
 * Why context rather than a global React Query key?
 * The active org is *UI state*, not server state — the server does not know
 * which org is "active"; it only knows which org the request is scoped to via
 * the X-Org-ID header.  Keeping it in context (backed by localStorage) is the
 * right layer: it is client-only, survives navigation, and is cleared on logout
 * by the Topbar's `queryClient.clear()` call (which also clears the query cache).
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

// ── Context shape ─────────────────────────────────────────────────────────────

interface OrgContextValue {
  /** The currently selected organisation, or `null` while loading / if the user
   *  has no orgs yet. */
  activeOrg: Organization | null;
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
  useEffect(() => {
    if (orgs.length === 0) return;
    const stored = orgs.find((o) => o.id === activeOrgId);
    if (!stored) {
      const first = orgs[0];
      setActiveOrgId(first.id);
      localStorage.setItem(LS_KEY, first.id);
    }
  }, [orgs, activeOrgId]);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;

  const setActiveOrg = useCallback(
    (org: Organization) => {
      setActiveOrgId(org.id);
      localStorage.setItem(LS_KEY, org.id);
      // Invalidate everything scoped to the previous org.  `removeQueries` on
      // the keys that carry org data would be more surgical, but the surface is
      // large (conversations, documents, dashboard, messages) and will grow.
      // Clearing the whole cache is safe: every query re-fetches on next render,
      // and the org list itself is re-fetched too — which is fine because it is
      // cheap and ensures the switcher reflects any membership changes.
      queryClient.clear();
    },
    [queryClient],
  );

  return (
    <OrgContext.Provider value={{ activeOrg, orgs, setActiveOrg, isLoading }}>
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
