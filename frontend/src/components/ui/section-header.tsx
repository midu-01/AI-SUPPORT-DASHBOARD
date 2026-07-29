import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  /** Trailing slot — usually the section's primary action. */
  action?: ReactNode;
  /*
    Every current call site is a page title, so `h1` is the default. It is a prop
    because heading level is a document-structure decision, not a styling one:
    WCAG 1.3.1 wants one `h1` per page and no skipped levels, so a second
    `SectionHeader` further down a page must be able to say `h2` without also
    changing size. `as` controls the tag; `title` styling is fixed.
  */
  as?: "h1" | "h2";
  className?: string;
}

/**
 * Page and section heading: title + optional description + optional action.
 *
 * Replaces the same six-line block repeated in five files, each with slightly
 * different wrapper flex rules — which is why the Members and Conversations page
 * headers currently align their buttons differently (`items-start` vs
 * `sm:items-center`) for no deliberate reason.
 */
export function SectionHeader({
  title,
  description,
  action,
  as: Heading = "h1",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        // Stacks on mobile, splits on `sm`. The action drops below the text
        // rather than squeezing it — a truncated page title next to a button is
        // worse than two rows.
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {/* `text-title` is 22px/600 with -0.015em tracking, one step above the
            `text-xl` these headers used — the type ramp exists so a page title
            outranks a card title, which at `text-xl` vs `text-sm` it barely did. */}
        <Heading className="truncate text-title text-fg">{title}</Heading>
        {description && (
          <p className="mt-1 text-sm text-fg-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
