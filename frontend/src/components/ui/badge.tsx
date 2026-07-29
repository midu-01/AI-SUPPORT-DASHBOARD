import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/types/api";

/*
  ── Badge ───────────────────────────────────────────────────────────────────

  A generic label chip. Extracted because three places hand-rolled the same
  markup with three different corner radii and three different greys: the
  document type chip (`rounded-md bg-slate-100 text-slate-600`), the member role
  label (`rounded-full bg-amber-100`/`bg-slate-100`), and `StatusBadge` below.

  Tones use the `-subtle` / `-on` token pairs, which exist precisely for this:
  a pale background with a text colour measured to clear 4.5:1 against it. The
  previous hand-rolled `bg-amber-100 text-amber-800` was a guess that happened
  to pass; `warning-subtle` + `warning-on` is 4.79:1 by measurement.
*/
const TONES = {
  neutral: "bg-canvas text-fg-muted",
  brand: "bg-brand-subtle text-brand",
  success: "bg-success-subtle text-success-on",
  warning: "bg-warning-subtle text-warning-on",
  danger: "bg-danger-subtle text-danger-on",
  info: "bg-info-subtle text-info-on",
} as const;

/*
  `pill` for things that read as labels attached to a person or state; `chip`
  for things that read as data — a file extension is closer to a value than to
  a tag. Keeping both means the two existing shapes are preserved rather than
  flattened into one, which would have been a silent visual change in a step
  about consolidation.
*/
const SHAPES = {
  chip: "rounded-chip",
  pill: "rounded-full",
} as const;

interface BadgeProps {
  tone?: keyof typeof TONES;
  shape?: keyof typeof SHAPES;
  /** Leading glyph. Must be decorative — the label carries the meaning. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  shape = "pill",
  icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        SHAPES[shape],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/*
  ── StatusBadge ─────────────────────────────────────────────────────────────

  Document processing state. Every document is `uploaded` today — the other three
  exist because the schema models a pipeline that could be added later. Styling
  all four now means adding that pipeline needs no change here.

  Three redundant signals, not one. WCAG 1.4.1 requires that colour never be the
  sole carrier of meaning, and this now satisfies it three ways over: the word is
  always shown, the tones come from the semantic scale, and the leading dot gives
  each state a distinguishable *shape* at a glance — a filled dot for terminal
  states, a ring for the one that is still in flight.

  The dot is the addition in this step. Its value is not accessibility (the word
  already handled that) but scanning: in a column of twenty rows, a reader tracks
  dot position and fill far faster than they read twenty words.
*/
const STATUS_TONES: Record<DocumentStatus, keyof typeof TONES> = {
  uploaded: "neutral",
  processing: "warning",
  indexed: "success",
  failed: "danger",
};

/*
  `processing` is a hollow ring: it is the only non-terminal state, and "not yet
  filled in" is a better metaphor for in-progress than a solid dot. `border-2`
  on a `size-1.5` element leaves a ~2px hole, which is enough to read as hollow
  at this size.
*/
const STATUS_DOTS: Record<DocumentStatus, string> = {
  uploaded: "bg-fg-subtle",
  processing: "border-2 border-warning bg-transparent",
  indexed: "bg-success",
  failed: "bg-danger",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge
      tone={STATUS_TONES[status]}
      icon={
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            STATUS_DOTS[status],
          )}
          aria-hidden="true"
        />
      }
      className="capitalize"
    >
      {status}
    </Badge>
  );
}
