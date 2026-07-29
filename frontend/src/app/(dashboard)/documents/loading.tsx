import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="mx-auto max-w-5xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading documents…</span>

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Upload zone */}
      <Skeleton variant="rect" className="mt-5 h-32 w-full" />

      {/* Table */}
      <Card className="mt-5">
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-4" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton variant="circle" className="h-5 w-16" />
              <Skeleton variant="control" className="size-8" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
