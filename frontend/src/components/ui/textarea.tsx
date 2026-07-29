"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentProps,
} from "react";

import {
  CONTROL_BASE,
  FieldShell,
  controlBorder,
  useFieldIds,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface TextareaProps extends Omit<ComponentProps<"textarea">, "id"> {
  /** Omit to render without a visible label — pass `aria-label` instead. */
  label?: string;
  error?: string;
  helper?: string;
  /** Grow with content instead of scrolling. Caps at `maxRows`. */
  autoResize?: boolean;
  maxRows?: number;
}

/**
 * A textarea with optional auto-resize.
 *
 * The auto-resize was previously inlined in `conversation-detail.tsx` as a
 * `useEffect` on the draft value. It lives here now so the composer does not own
 * DOM-measuring logic, and so any future form gets the same behaviour.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      error,
      helper,
      autoResize = false,
      maxRows = 8,
      className,
      value,
      onChange,
      ...props
    },
    ref,
  ) {
    const { id, errorId, helperId, describedBy } = useFieldIds({
      error,
      helper,
    });

    /*
      An internal ref is needed because the resize measures the element, but the
      caller may also want a ref of its own (the composer focuses the field).
      `useImperativeHandle` forwards the same node to both rather than making
      the caller choose.
    */
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    /*
      Reset to `auto` before reading `scrollHeight`: the property reports the
      content height *or* the current fixed height, whichever is larger, so
      without the reset the box can grow but never shrink back when text is
      deleted.

      The `maxRows` cap is the part the inlined version was missing. Uncapped, a
      long paste expanded the composer until it pushed the message thread off
      screen — the input grew without limit because nothing told it not to.
      Past the cap it scrolls, which is what `overflow-y-auto` below is for.
    */
    useEffect(() => {
      const el = innerRef.current;
      if (!el || !autoResize) return;

      el.style.height = "auto";
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      const maxHeight = lineHeight * maxRows;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [value, autoResize, maxRows]);

    const control = (
      <textarea
        ref={innerRef}
        id={id}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          CONTROL_BASE,
          controlBorder(error),
          "py-2",
          autoResize ? "resize-none" : "resize-y",
          className,
        )}
        {...props}
      />
    );

    /*
      No label means no `FieldShell`: rendering an empty `<label htmlFor>` would
      put an unlabelled label in the accessibility tree. The composer is the case
      — it has a visible placeholder and an `aria-label`, and a visible "Message"
      heading above a chat input would be noise.
    */
    if (!label) return control;

    return (
      <FieldShell
        id={id}
        label={label}
        helper={helper}
        helperId={helperId}
        error={error}
        errorId={errorId}
      >
        {control}
      </FieldShell>
    );
  },
);
