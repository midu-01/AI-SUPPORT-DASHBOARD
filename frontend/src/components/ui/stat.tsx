import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  A labelled metric. Two sizes because the dashboard needs one number to lead and
  the rest to support — the app's current problem is that every number is
  `text-2xl` and nothing ranks.

  `md` uses `text-metric` (32px), `lg` uses `text-display` (44px). Both tokens
  carry their own weight and tracking, so there is no `font-bold tracking-tight`
  to repeat here or get wrong at one call site.
*/
const SIZES = {
  md: "text-metric",
  lg: "text-display",
} as const;

interface StatProps {
  label: string;
  value: string | number;
  size?: keyof typeof SIZES;
  /* Slot rather than a `data` prop: the sparkline arrives in Phase 4 and there is
     no point guessing its shape now. `Stat` owns the type ramp; whatever renders
     the trend owns its own markup. */
  chart?: ReactNode;
  className?: string;
}

export function Stat({
  label,
  value,
  size = "md",
  chart,
  className,
}: StatProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {/*
        `numeric` is mandatory here, not decorative. These counts re-render on
        refetch, and proportional digits are per-glyph widths — a `1` is narrower
        than a `7`, so a number changing from 17 to 18 shifts everything beside
        it. Formatted with `toLocaleString` at the call site, not here, because
        `value` also accepts a pre-formatted string (file sizes, durations).
      */}
      <span className="numeric block truncate text-fg">
        <span className={SIZES[size]}>{value}</span>
      </span>

      {/*
        `text-label` is 11px uppercase with +0.09em tracking. Small caps text
        needs positive tracking to stay legible, which is why this is a token and
        not `text-xs uppercase` — the latter is what the app does today and it
        reads as cramped.
      */}
      <span className="mt-1 block truncate text-label uppercase text-fg-muted">
        {label}
      </span>

      {chart && <div className="mt-2">{chart}</div>}
    </div>
  );
}
