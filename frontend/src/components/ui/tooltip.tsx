"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TooltipProps {
  /** The full text. Rendered in the bubble and linked via `aria-describedby`. */
  label: string;
  children: ReactNode;
  /** Above by default; below when the trigger is near the top of the viewport. */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Reveals text that is visually truncated.
 *
 * CSS-driven: shown on `hover` and on `focus-visible` within the wrapper, with
 * no state and no positioning JS. The trigger carries `tabIndex={0}` so keyboard
 * users can reach it — a truncated `<span>` is not focusable on its own, and
 * "hover to see the rest" is not an interaction a keyboard has.
 *
 * The bubble is `aria-hidden` and the full text is attached to the trigger with
 * `aria-describedby` instead. A screen reader already reads the complete text
 * node — CSS truncation is visual only — so announcing the bubble as well would
 * repeat it.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const id = useId();

  return (
    <span className={cn("group/tt relative inline-flex min-w-0", className)}>
      <span
        tabIndex={0}
        aria-describedby={id}
        className="min-w-0 truncate rounded-chip outline-offset-2"
      >
        {children}
      </span>

      <span
        id={id}
        role="tooltip"
        aria-hidden="true"
        className={cn(
          // `max-w` + `break-words`: the point is to reveal the full string, so
          // the bubble must be allowed to wrap. A tooltip that truncates is not
          // a fix for truncation.
          "pointer-events-none absolute left-0 z-50 w-max max-w-xs",
          "rounded-control bg-shell px-2 py-1 text-xs text-shell-fg shadow-floating",
          "break-words",
          // Hidden by opacity rather than `display`, so the fade is animatable
          // and `duration-fast` applies. `invisible` keeps it out of the hit-test
          // and the a11y tree while collapsed.
          "invisible opacity-0 transition-[opacity,visibility] duration-fast",
          "group-hover/tt:visible group-hover/tt:opacity-100",
          "group-focus-within/tt:visible group-focus-within/tt:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {label}
      </span>
    </span>
  );
}
