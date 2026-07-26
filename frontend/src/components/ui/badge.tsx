import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/types/api";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-800",
  indexed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-700",
};

/**
 * Document processing state.
 *
 * Every document is `uploaded` today — the other three exist because the schema
 * models a pipeline that could be added later. Styling all four now means adding
 * that pipeline needs no change here.
 *
 * The colour is not the only signal: the word is always shown, so the state is
 * still legible to anyone who cannot distinguish amber from green.
 */
export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}
