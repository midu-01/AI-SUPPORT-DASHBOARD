"use client";

/**
 * Organisation switcher dropdown.
 *
 * Renders in the Topbar between the user info and the sign-out button.
 * Built on the native <select> for the same reason the modals use <dialog>:
 * the platform supplies keyboard navigation, screen-reader announcements, and
 * mobile-native pickers for free.  A custom dropdown would need to re-implement
 * all of that, and the brief asks for clean and maintainable over polished.
 *
 * When the user picks a different org:
 *  1. `setActiveOrg` updates the context and persists to localStorage.
 *  2. The entire React Query cache is cleared (inside setActiveOrg).
 *  3. Every query on the current page re-fetches automatically because their
 *     data is now stale — React Query's `useQuery` hooks re-run on the next
 *     render and find an empty cache.
 */

import { Building2 } from "lucide-react";

import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const { activeOrg, orgs, setActiveOrg, isLoading } = useOrg();

  // While loading or if the user has no orgs yet, render a disabled placeholder
  // so the layout does not shift when the list arrives.
  if (isLoading || orgs.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-slate-400">
        <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">
          {isLoading ? "Loading…" : "No organisations"}
        </span>
      </div>
    );
  }

  // Single-org users: show the name without a dropdown — there is nothing to
  // switch to, and a disabled <select> is visually confusing.
  if (orgs.length === 1) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-slate-700"
        title={activeOrg?.name}
      >
        <Building2 className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
        <span className="hidden max-w-[120px] truncate sm:inline">
          {activeOrg?.name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      <Building2
        className="pointer-events-none absolute left-2.5 size-3.5 shrink-0 text-brand"
        aria-hidden="true"
      />
      {/*
       * The <select> is the accessible primitive for a list of mutually-exclusive
       * choices.  `aria-label` names it for screen readers since there is no
       * visible <label> — the building icon is decorative.
       */}
      <select
        aria-label="Active organisation"
        value={activeOrg?.id ?? ""}
        onChange={(e) => {
          const org = orgs.find((o) => o.id === e.target.value);
          if (org) setActiveOrg(org);
        }}
        className={cn(
          "h-8 appearance-none rounded-lg border border-border bg-surface",
          "pl-7 pr-6 text-xs font-medium text-slate-700",
          "focus:outline-none focus:ring-2 focus:ring-brand/40",
          "max-w-[140px] truncate sm:max-w-[180px]",
          "cursor-pointer transition-colors hover:bg-slate-50",
        )}
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {/* Custom chevron — the browser's native arrow is hidden by `appearance-none` */}
      <svg
        className="pointer-events-none absolute right-2 size-3 text-slate-400"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 4l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
