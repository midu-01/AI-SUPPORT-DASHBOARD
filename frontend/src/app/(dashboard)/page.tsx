import { getCurrentUser } from "@/lib/server-api";

/**
 * Dashboard home.
 *
 * Step 8 establishes the authenticated shell; Step 9 replaces this body with
 * the stat row, recent conversations, and recent documents, fetched from
 * `GET /dashboard/summary`.
 */
export default async function DashboardPage() {
  // Safe to assert: the layout above redirects when this is null.
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        Welcome back, {user?.full_name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Your conversations and documents at a glance.
      </p>
    </div>
  );
}
