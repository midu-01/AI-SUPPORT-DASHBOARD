import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/server-api";

/**
 * Shell for every signed-in page.
 *
 * A Server Component, so the user is resolved before any HTML is sent — no
 * loading flash, and no client-side request just to render a name in the
 * corner.
 *
 * This is also the *real* auth gate. `proxy.ts` redirects earlier and faster,
 * but it only checks that a cookie is present, never that it is valid. Here the
 * backend is asked, and a forged or expired token fails. Both exist on purpose:
 * the proxy avoids a pointless render, this avoids trusting it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <MobileNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
