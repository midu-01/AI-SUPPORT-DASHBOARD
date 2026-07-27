"use client";

import { useEffect, useRef } from "react";

import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Styles the confirm button as destructive and reddens the icon. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation modal built on the native `<dialog>` element.
 *
 * This is the component that would most have justified pulling in Radix, and
 * the reason it doesn't: `showModal()` gives focus trapping, Escape-to-close,
 * `aria-modal`, inertness of the background, and a `::backdrop` for free, from
 * the platform. What is left to write by hand is the open/close syncing below.
 *
 * The one genuine subtlety: `showModal()` throws if the dialog is already open,
 * and `close()` on an already-closed dialog fires a spurious `close` event — so
 * both are guarded on `el.open` rather than called unconditionally.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Escape fires the native `cancel` event. Without telling the parent, React
    // state would still say "open" while the dialog is visually closed — and it
    // would then refuse to reopen.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (!pending) onCancel();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onCancel, pending]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface p-0 shadow-lg backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">{description}</p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={pending}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
