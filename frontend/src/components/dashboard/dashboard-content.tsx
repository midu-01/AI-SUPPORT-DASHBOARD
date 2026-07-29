"use client";

import { RecentConversations } from "@/components/dashboard/recent-conversations";
import { RecentDocuments } from "@/components/dashboard/recent-documents";
import { StatRow } from "@/components/dashboard/stat-row";
import { UserCard } from "@/components/dashboard/user-card";
import { DashboardAwaitingOrg } from "@/components/dashboard/awaiting-org";
import { SectionHeader } from "@/components/ui/section-header";
import { useOrgFetch } from "@/hooks/use-org-fetch";
import { useOrg } from "@/lib/org-context";
import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "@/types/api";

export function DashboardContent() {
  const { orgId, isLoading: isOrgLoading } = useOrg();
  const orgFetch = useOrgFetch();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => orgFetch<DashboardSummary>("/dashboard/summary"),
    enabled: Boolean(orgId),
  });

  if (isOrgLoading || !orgId || isLoading) {
    return <DashboardAwaitingOrg refreshServer={false} />;
  }

  if (error || !summary) {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load the dashboard. Try refreshing the page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        title={`Welcome back, ${summary.user.full_name.split(" ")[0]}`}
        description="Your conversations and documents at a glance."
      />

      <StatRow
        conversations={summary.total_conversations}
        documents={summary.total_documents}
        messages={summary.total_messages}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RecentConversations items={summary.recent_conversations} />
          <RecentDocuments items={summary.recent_documents} />
        </div>
        <UserCard user={summary.user} />
      </div>
    </div>
  );
}
