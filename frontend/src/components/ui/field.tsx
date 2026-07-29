"use client";

import { useId, type ReactNode } from "react";

/*
  ── Field: the shared label / helper / error wiring ─────────────────────────

  This exists so `TextField` and `Textarea` do not each carry their own copy of
  it. The original `TextField` comment made the point that this relationship "is
  the part people get wrong, so it is done once here rather than repeated per
  form" — writing a second control by copying that block would have contradicted
  the comment while quoting it.

  The wiring, in one place:

  - `useId` generates a collision-free id, so `htmlFor` actually points at the
    control. An unassociated label is one a screen reader will not read, and
    clicking it will not focus the field.
  - `aria-invalid` marks the control as failed.
  - `aria-describedby` links *both* the helper text and the error message, in
    that order, so a reader hears the format hint and then what went wrong.
    A control with helper text and an error needs both ids, not the last one to
    be written — which is the bug this hook exists to make impossible.
  - `role="alert"` announces the error the moment it appears.
*/

export function useFieldIds({
  error,
  helper,
}: {
  error?: string;
  helper?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const describedBy =
    [helper ? helperId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return { id, errorId, helperId, describedBy };
}

/*
  Shared control chrome. `text-base` on mobile is not a style choice: iOS Safari
  auto-zooms the whole page when a focused input's font-size is below 16px, and
  `text-sm` (14px) triggers it on every field in the app. The zoom does not
  reverse on blur, so the user is left on a magnified, horizontally-scrolling
  page after typing one character. 16px up to `sm`, 14px above it — where no
  iPhone viewport lands and the denser size is preferable.
*/
export const CONTROL_BASE = [
  "block w-full rounded-control border bg-surface px-3",
  "text-base sm:text-sm text-fg placeholder:text-fg-subtle",
  "transition-colors duration-fast",
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-fg-muted",
].join(" ");

export function controlBorder(error?: string): string {
  return error
    ? "border-danger enabled:hover:border-danger-on"
    : "border-border enabled:hover:border-border-strong";
}

interface FieldShellProps {
  id: string;
  label: string;
  helper?: string;
  helperId: string;
  error?: string;
  errorId: string;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  helper,
  helperId,
  error,
  errorId,
  children,
}: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>

      {children}

      {/*
        Helper text is persistent — it stays visible while the field is filled
        in, and it stays visible alongside an error. A placeholder is not helper
        text: it disappears at the moment the user starts typing, which is
        exactly when a format hint becomes useful.
      */}
      {helper && (
        <p id={helperId} className="text-xs text-fg-muted">
          {helper}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger-on">
          {error}
        </p>
      )}
    </div>
  );
}
