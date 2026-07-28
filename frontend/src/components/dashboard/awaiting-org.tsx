"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useOrg } from "@/lib/org-context";

/**
 * Shown when the dashboard Server Component detects that the `activeOrgId`
 * cookie is not yet set — which happens on the very first render after
 * registration, before `OrgProvider` has mounted and written the cookie.
 *
 * Once the org context resolves and the cookie is written, this component
 * calls `router.refresh()` exactly once so the Server Component re-renders
 * with the cookie in place.
 */
export function DashboardAwaitingOrg() {
  const { orgId, isLoading } = useOrg();
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    if (!isLoading && orgId && !refreshed.current) {
      refreshed.current = true;
      // Small delay to ensure the cookie has been written by OrgProvider
      // before the server re-renders.
      setTimeout(() => router.refresh(), 100);
    }
  }, [orgId, isLoading, router]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
