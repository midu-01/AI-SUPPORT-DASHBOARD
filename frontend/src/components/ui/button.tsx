import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "border border-border bg-surface text-slate-700 hover:bg-slate-50",
  danger: "bg-danger text-white hover:bg-red-700",
  ghost: "text-slate-600 hover:bg-slate-100",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
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
