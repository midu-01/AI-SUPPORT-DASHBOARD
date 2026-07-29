import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading members…</span>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton variant="control" className="h-8 w-28" />
      </div>

      {/* Members list */}
      <Card className="mt-5">
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton variant="circle" className="size-9" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton variant="circle" className="h-5 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
