"use client";

import { forwardRef, useId, type ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  /** Validation message. Its presence is what marks the input invalid. */
  error?: string;
}

/**
 * A labelled text input that owns its own accessibility wiring.
 *
 * The label/error/input relationship is the part people get wrong, so it is
 * done once here rather than repeated per form:
 *
 * - `useId` generates a collision-free id, so `htmlFor` actually points at the
 *   input. A label that isn't associated is a label a screen reader won't read,
 *   and clicking it won't focus the field.
 * - `aria-invalid` marks the field as failed.
 * - `aria-describedby` links the message to the input, so the reason is
 *   announced on focus instead of only being visible.
 * - `role="alert"` announces the error the moment it appears, without the user
 *   having to go looking for it.
 *
 * `forwardRef` is used so callers can focus the input imperatively (e.g. the
 * CreateOrgDialog focuses the name field when the modal opens).
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, error, className, ...props }, ref) {
    const id = useId();
    const errorId = `${id}-error`;

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-slate-900",
            "placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50",
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
