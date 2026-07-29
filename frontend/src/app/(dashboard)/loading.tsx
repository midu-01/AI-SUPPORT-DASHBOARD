import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the dashboard's server render is in flight.
 *
 * `loading.tsx` is App Router's Suspense boundary: Next streams this shell
 * immediately and swaps in the page when the data resolves, so the nav is
 * usable rather than the whole screen being blank.
 *
 * The layout mirrors the real page's shape — a skeleton with different
 * proportions produces a visible jump on swap, which is worse than no skeleton.
 */
export default function DashboardLoading() {
  return (
    // `aria-busy` + a polite live region announces the wait once, instead of
    // leaving a screen reader on a silent page.
    <div
      className="mx-auto max-w-5xl space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading dashboard…</span>

      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[0, 1].map((card) => (
            <Card key={card}>
              <div className="border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="divide-y divide-border">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="space-y-4 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-14" />
                <Skeleton className="mt-1.5 h-4 w-36" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
