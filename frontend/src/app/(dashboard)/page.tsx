import { cookies } from "next/headers";

import { DashboardAwaitingOrg } from "@/components/dashboard/awaiting-org";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

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
 *
 * **Edge case: no active org cookie yet.** A freshly-registered user has an org
 * (auto-created on registration) but the `activeOrgId` cookie is not set until
 * `OrgProvider` mounts on the client. If we call `/dashboard/summary` without
 * `X-Org-ID` the backend returns 400. Instead we render a lightweight client
 * component that waits for the org context to initialise, then triggers a
 * router refresh so this page re-renders with the cookie in place.
 */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("activeOrgId")?.value;

  // No org cookie yet — the client-side OrgProvider will set it momentarily.
  // Show a brief loading state instead of crashing with ORG_REQUIRED.
  if (!activeOrgId) {
    return <DashboardAwaitingOrg />;
  }

  return <DashboardContent />;
}
