import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ConversationDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading conversation…</span>

      <Skeleton className="h-4 w-32" />

      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton variant="control" className="size-8" />
      </div>
      <Skeleton className="mt-2 h-4 w-32" />

      {/* Same `min-h-96` as the real thread panel in `conversation-detail.tsx`.
          A loading card shorter than the content it stands in for shifts the
          page the moment data arrives. */}
      <Card className="mt-5 min-h-96">
        <CardBody className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                i % 2 === 0 ? "justify-end" : "justify-start",
              )}
            >
              <Skeleton
                variant="rect"
                className={cn("h-16", i % 2 === 0 ? "w-3/5" : "w-2/5")}
              />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
