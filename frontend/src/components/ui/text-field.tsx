"use client";

import { forwardRef, type ComponentProps } from "react";

import {
  CONTROL_BASE,
  FieldShell,
  controlBorder,
  useFieldIds,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

/*
  Heights, not padding. `h-11` (44px) is the WCAG 2.5.5 touch-target minimum and
  the same height `Button size="icon"` got in Step 2.1 — a form row where the
  input and its submit button differ by 4px reads as a misalignment. The previous
  `py-2` produced ~38px, below the minimum on every field in the app.
*/
const SIZES = {
  sm: "h-9 sm:h-8",
  md: "h-11 sm:h-10",
} as const;

interface TextFieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  /** Validation message. Its presence is what marks the input invalid. */
  error?: string;
  /** Persistent format hint. Stays visible while typing, unlike a placeholder. */
  helper?: string;
  size?: keyof typeof SIZES;
}

/**
 * A labelled text input. The label/helper/error accessibility wiring lives in
 * `field.tsx` and is shared with `Textarea` — see the comment there.
 *
 * `forwardRef` is used so callers can focus the input imperatively (e.g. the
 * CreateOrgDialog focuses the name field when the modal opens).
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, error, helper, size = "md", className, ...props },
    ref,
  ) {
    const { id, errorId, helperId, describedBy } = useFieldIds({
      error,
      helper,
    });

    return (
      <FieldShell
        id={id}
        label={label}
        helper={helper}
        helperId={helperId}
        error={error}
        errorId={errorId}
      >
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL_BASE, controlBorder(error), SIZES[size], className)}
          {...props}
        />
      </FieldShell>
    );
  },
);
