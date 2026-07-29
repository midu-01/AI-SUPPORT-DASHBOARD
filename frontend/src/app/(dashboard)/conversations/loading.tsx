import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationsLoading() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading conversations…</span>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton variant="control" className="h-8 w-40" />
      </div>

      {/* Search */}
      {/* Matches the search input's new `h-11 sm:h-10` from Step 2.4 — a
          skeleton that is 4px shorter than the control it stands in for shifts
          the page when data arrives. */}
      <Skeleton variant="control" className="mt-5 h-11 w-full sm:h-10" />

      {/* List */}
      <Card className="mt-4">
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton variant="control" className="size-8" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
