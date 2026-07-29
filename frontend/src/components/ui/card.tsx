import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  ── Elevation ───────────────────────────────────────────────────────────────

  Four tiers from globals.css, replacing "one `shadow-sm` on everything". This
  is a visual change, not just a rename: Tailwind's `shadow-sm` is a two-layer
  black shadow, while `--shadow-raised` is a single 2px slate one. Cards get
  quieter — depth is supposed to come from the shell/workspace contrast, not
  from every card shouting.

  All four live in the `--shadow-*` namespace, so they are mutually exclusive by
  construction: `shadow-sunken shadow-raised` cannot both apply. For a tier
  system that is the correct property — an element is at one elevation. (v4 also
  ships an `--inset-shadow-*` namespace that would let `sunken` compose with a
  drop shadow. Deliberately not used: composing tiers is the thing this table
  exists to prevent.)
*/
const ELEVATIONS = {
  sunken: "shadow-sunken",
  flat: "shadow-flat",
  raised: "shadow-raised",
  floating: "shadow-floating",
} as const;

/*
  ── Accent ──────────────────────────────────────────────────────────────────

  A 3px domain-hue rule down the leading edge. This is the main mechanism that
  makes the dashboard scannable by colour rather than by reading every heading.

  Drawn as a pseudo-element rather than `border-l-[3px]`, because a thicker left
  border pushes the card's *content* 2px right — and several cards hold a
  full-width `<ul>`, which would then sit asymmetrically inside its own
  container. The pseudo-element overlays the hairline instead of replacing it
  (`-left-px`, `-inset-y-px`), so the strip reads flush with the card's outer
  edge and nothing in the content box moves.
*/
const ACCENTS = {
  conversations: "before:bg-conversations",
  documents: "before:bg-documents",
  members: "before:bg-members",
} as const;

const ACCENT_BASE =
  "relative before:absolute before:-inset-y-px before:-left-px before:w-[3px] before:rounded-l-card before:content-['']";

interface CardProps extends ComponentProps<"div"> {
  elevation?: keyof typeof ELEVATIONS;
  /** Domain hue for the leading-edge rule. Omit for a neutral card. */
  accent?: keyof typeof ACCENTS;
}

export function Card({
  elevation = "raised",
  accent,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface",
        ELEVATIONS[elevation],
        accent && [ACCENT_BASE, ACCENTS[accent]],
        className,
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: string;
  /** Rendered on the right of the header — usually a link or button. */
  action?: ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    // `px-4 py-3`, not the previous `px-5 py-3.5`. Both of those were off the
    // spacing rhythm documented in globals.css, and that comment names this
    // exact header as the pattern being replaced.
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {action}
    </div>
  );
}

/*
  ── Padding ─────────────────────────────────────────────────────────────────

  The default drops from `p-5` (20px) to `p-4` (16px) — `5` is not on the
  spacing scale this design uses, and hardcoding it meant every call site that
  wanted anything else had to override with a conflicting utility.

  `none` exists for cards whose child owns its own padding: a `divide-y` list
  needs the rows padded, not the container, or the dividers stop at the padding
  edge instead of spanning the card.
*/
const PADDINGS = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

interface CardBodyProps extends ComponentProps<"div"> {
  padding?: keyof typeof PADDINGS;
}

export function CardBody({
  padding = "md",
  className,
  ...props
}: CardBodyProps) {
  return <div className={cn(PADDINGS[padding], className)} {...props} />;
}

/**
 * Shown when a list has no rows.
 *
 * A dedicated component because empty states are the thing most often skipped,
 * and a blank panel reads as a bug rather than as "nothing here yet".
 */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-fg-muted">{message}</p>
      {action}
    </div>
  );
}
