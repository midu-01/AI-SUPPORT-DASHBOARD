"use client";

/**
 * Organisation switcher dropdown + "New organisation" button.
 *
 * Renders in the Topbar between the user info and the sign-out button.
 * Built on the native <select> for the same reason the modals use <dialog>:
 * the platform supplies keyboard navigation, screen-reader announcements, and
 * mobile-native pickers for free.  A custom dropdown would need to re-implement
 * all of that, and the brief asks for clean and maintainable over polished.
 *
 * When the user picks a different org:
 *  1. `setActiveOrg` updates the context and persists to localStorage + cookie.
 *  2. The entire React Query cache is cleared (inside setActiveOrg).
 *  3. Every query on the current page re-fetches automatically because their
 *     data is now stale — React Query's `useQuery` hooks re-run on the next
 *     render and find an empty cache.
 *
 * The "+ New" button opens `CreateOrgDialog`.  It sits beside the switcher so
 * the user can create and immediately switch to a new org without navigating
 * away from whatever page they are on.
 */

import { Building2, Plus } from "lucide-react";
import { useState } from "react";

import { CreateOrgDialog } from "./create-org-dialog";
import { useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const { activeOrg, orgs, setActiveOrg, isLoading } = useOrg();
  const [showCreate, setShowCreate] = useState(false);

  // While loading or if the user has no orgs yet, render a disabled placeholder
  // so the layout does not shift when the list arrives.
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-slate-400">
        <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Loading…</span>
      </div>
    );
  }

  // No orgs yet — show only the create button so the user can bootstrap.
  if (orgs.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:border-brand hover:text-brand"
          aria-label="Create your first organisation"
        >
          <Plus className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">New org</span>
        </button>
        <CreateOrgDialog open={showCreate} onClose={() => setShowCreate(false)} />
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Switcher --------------------------------------------------------- */}
      {orgs.length === 1 ? (
        // Single-org users: show the name without a dropdown — there is nothing
        // to switch to, and a disabled <select> is visually confusing.
        <div
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-slate-700"
          title={activeOrg?.name}
        >
          <Building2 className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="hidden max-w-[120px] truncate sm:inline">
            {activeOrg?.name}
          </span>
        </div>
      ) : (
        <div className="relative flex items-center">
          <Building2
            className="pointer-events-none absolute left-2.5 size-3.5 shrink-0 text-brand"
            aria-hidden="true"
          />
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
      )}

      {/* New org button --------------------------------------------------- */}
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-slate-500 transition-colors hover:border-brand hover:text-brand"
        aria-label="Create a new organisation"
        title="New organisation"
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>

      <CreateOrgDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
