"use client";

/**
 * Members list for the active organisation.
 *
 * Shows all members with their role and join date. Admins see an "Invite member"
 * button that opens the InviteMemberDialog. The list is fetched via React Query
 * with the org-scoped fetch hook, so switching orgs automatically refreshes it.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shield, UserPlus } from "lucide-react";

import { InviteMemberDialog } from "@/components/layout/invite-member-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { useOrgFetch } from "@/hooks/use-org-fetch";
import { useOrg } from "@/lib/org-context";
import { formatDate } from "@/lib/utils";
import type { MemberDetail } from "@/types/api";

export function MembersContent() {
  const { orgId, activeOrg, isLoading: isOrgLoading } = useOrg();
  const orgFetch = useOrgFetch();
  const [showInvite, setShowInvite] = useState(false);

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery<MemberDetail[]>({
    queryKey: ["members", orgId],
    queryFn: () => orgFetch<MemberDetail[]>(`/organizations/${orgId}/members`),
    enabled: Boolean(orgId),
  });

  // Determine if the current user is an admin of this org.
  // The invite button is shown to everyone — the backend enforces the admin
  // check and the dialog handles the FORBIDDEN error gracefully. This is a
  // UI convenience, not a security boundary.

  if (isOrgLoading || !orgId || isLoading) {
    return (
      <div className="mx-auto max-w-3xl" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading members…</span>
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-56 animate-pulse rounded-md bg-slate-200" />
        </div>
        <Card className="mt-5">
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="size-9 animate-pulse rounded-full bg-slate-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/5 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-3 w-1/3 animate-pulse rounded-md bg-slate-200" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          Could not load members. Try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Members
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeOrg?.name} · {members.length}{" "}
            {members.length === 1 ? "member" : "members"}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowInvite(true)}
        >
          <UserPlus className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Invite member</span>
          <span className="sm:hidden">Invite</span>
        </Button>
      </div>

      <Card>
        {members.length === 0 ? (
          <EmptyState
            message="No members yet."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowInvite(true)}
              >
                <UserPlus className="size-3.5" aria-hidden="true" />
                Invite the first member
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border" role="list">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Avatar placeholder — initials in a circle */}
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {getInitials(member.full_name)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {member.full_name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {member.email}
                  </p>
                </div>

                {/* Role badge */}
                <span
                  className={
                    member.role === "admin"
                      ? "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                      : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                  }
                >
                  {member.role === "admin" && (
                    <Shield className="size-3" aria-hidden="true" />
                  )}
                  {member.role === "admin" ? "Admin" : "Member"}
                </span>

                {/* Join date — hidden on very small screens */}
                <span className="hidden text-xs text-slate-400 sm:block">
                  Joined {formatDate(member.joined_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <InviteMemberDialog
        open={showInvite}
        onClose={() => setShowInvite(false)}
      />
    </div>
  );
}

/** Extract up to two initials from a full name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
