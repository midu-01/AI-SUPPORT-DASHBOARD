import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  Six variants, four sizes, four states.

  The `enabled:` prefix on every hover rule is not decoration. `:hover` still
  matches a disabled <button> in Chrome and Safari, so without it a disabled
  primary button still lightens under the cursor — which reads as "clickable"
  at the exact moment it is not. `enabled:hover:` scopes the hover to the state
  where it means something, and lets `disabled:cursor-not-allowed` survive
  (which `pointer-events-none` would silently kill).

  Contrast is measured, not assumed — see the table in globals.css:
    white on brand ......... 6.29:1 ✓   white on brand-hover .. 7.90:1 ✓
    white on danger ........ 4.83:1 ✓   danger is the ONE status fill that
                                        clears 4.5:1 with white text
    brand on brand-subtle .. 5.62:1 ✓   (subtle + outline variants)
*/
const VARIANTS = {
  primary: "bg-brand text-white enabled:hover:bg-brand-hover",
  secondary:
    "border border-border bg-surface text-slate-700 enabled:hover:bg-canvas enabled:hover:border-border-strong",
  /* `danger-on` is red-700 — the same value the old `hover:bg-red-700` used,
     now named for what it is rather than picked off the ramp. */
  danger: "bg-danger text-white enabled:hover:bg-danger-on",
  ghost: "text-fg-muted enabled:hover:bg-slate-100 enabled:hover:text-fg",
  /* Tinted, not filled. For secondary actions that still belong to the brand —
     "Start one" in an empty state, where `secondary` reads as too neutral and
     `primary` competes with the page's real primary action. */
  subtle: "bg-brand-subtle text-brand enabled:hover:bg-brand-100",
  /* Border-only brand. The one variant that works on a tinted background,
     because it has no fill of its own to clash with one. */
  outline:
    "border border-brand/40 text-brand enabled:hover:border-brand enabled:hover:bg-brand-subtle",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-base",
  /* A 44px square: the WCAG 2.5.5 / Apple HIG minimum touch target. The icon
     buttons this replaces were `size="sm"` — 32px tall — which is below the
     minimum on every one of them (the document row, the conversation row, and
     the four in the conversation header). Enlarging the *hit area* with a
     negative-inset pseudo-element would have kept them visually smaller, but
     these sit in `gap-2` clusters, so the expanded areas would meet with 0px
     between them and trade one touch failure for another. */
  icon: "size-11 shrink-0",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Disables the button and announces the wait to screen readers. */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // `type` defaults to "submit" inside a form, which silently submits when
      // the button was only meant to open a dialog. Callers opt in explicitly.
      type="button"
      disabled={disabled || loading}
      // Communicates the pending state to assistive tech; `disabled` alone is
      // visual and tells a screen reader nothing about *why*.
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-medium",
        /* `transform` rides the same transition as the colours so the press
           settles rather than snaps. `ease-spring` overshoots by design — on a
           2% scale that reads as a physical button; on a 150ms colour change
           the overshoot is imperceptible, which is why one curve covers both. */
        "transition-[color,background-color,border-color,transform] duration-fast ease-spring",
        /* State 3 of 4: pressed. Kept small — 0.98 is felt, not seen. */
        "active:scale-[0.98]",
        /* State 4 of 4: disabled. 0.45 rather than the old 0.6, because 0.6 on
           a `ghost` button was nearly indistinguishable from its enabled state.
           `active:scale-100` stops a disabled button from acknowledging a press
           it is going to ignore. */
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/*
  State 2 of 4 — focus — is deliberately absent from this file. The `:focus-visible`
  rule in globals.css rings every focusable element through the inherited
  `--focus-ring` custom property, so a Button rendered inside the dark shell gets
  a light ring and the same Button in the workspace gets an indigo one, with no
  prop and no knowledge of where it sits. A `focus:ring-*` utility here would
  hardcode one of those two and be wrong in the other place — which is exactly
  the bug that was removed from `org-switcher.tsx` and `invite-member-dialog.tsx`
  in Phase 1.
*/
