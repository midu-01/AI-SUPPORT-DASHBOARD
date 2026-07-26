import { RecentConversations } from "@/components/dashboard/recent-conversations";
import { RecentDocuments } from "@/components/dashboard/recent-documents";
import { StatRow } from "@/components/dashboard/stat-row";
import { UserCard } from "@/components/dashboard/user-card";
import { serverApiFetch } from "@/lib/server-api";
import type { DashboardSummary } from "@/types/api";

/**
 * Dashboard home.
 *
 * A Server Component with **no `"use client"` anywhere beneath it** — nothing on
 * this page is interactive beyond links, so none of it needs to ship as
 * JavaScript. The data is fetched on the server and arrives as HTML.
 *
 * One request, not four. `/dashboard/summary` returns the user, the three
 * counts, and both recent lists together, so there is no client-side waterfall
 * and no partially-populated page while four calls resolve at different times.
 */
export default async function DashboardPage() {
  const summary = await serverApiFetch<DashboardSummary>("/dashboard/summary");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {/* First name only — "Welcome back, Ada" reads better than the full
              legal name, and long names would wrap the heading. */}
          Welcome back, {summary.user.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your conversations and documents at a glance.
        </p>
      </div>

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
