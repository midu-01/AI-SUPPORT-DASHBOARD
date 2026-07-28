"use client";

/**
 * Modal for creating a new organisation.
 *
 * Built on the native <dialog> element — same reasoning as ConfirmDialog and
 * MobileNav: `showModal()` supplies focus trapping, Escape-to-close, aria-modal,
 * background inertness, and a ::backdrop from the platform.  What is left to
 * write by hand is the open/close syncing and the form.
 *
 * On success the new org is immediately set as the active org, so the user
 * lands in it without a manual switch.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { TextField } from "@/components/ui/text-field";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useOrg } from "@/lib/org-context";
import type { OrganizationCreated } from "@/types/api";

interface CreateOrgDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateOrgDialog({ open, onClose }: CreateOrgDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { setActiveOrg } = useOrg();

  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Open / close sync ────────────────────────────────────────────────────

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      // Reset form state before opening so the dialog always starts clean.
      setName("");
      setFieldError(null);
      setFormError(null);
      el.showModal();
      // Focus the input after the dialog opens so the user can type immediately
      // without a mouse click.  rAF defers until after the browser has painted
      // the dialog, which is when focus is actually movable into it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Escape fires the native `cancel` event and closes the dialog without
    // telling React — sync state back so it can reopen.
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!create.isPending) handleClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mutation ─────────────────────────────────────────────────────────────

  const create = useMutation({
    mutationFn: (orgName: string) =>
      apiFetch<OrganizationCreated>("/organizations", {
        method: "POST",
        body: { name: orgName },
      }),
    onSuccess: (data) => {
      // Invalidate the org list so the switcher reflects the new org.
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      // Close before setActiveOrg triggers router.refresh(). Otherwise the
      // current modal can remain open long enough to intercept interaction
      // with the refreshed switcher.
      ref.current?.close();
      onClose();
      // Switch to the new org immediately — the user just created it, so it is
      // almost certainly where they want to work next.
      setActiveOrg(data.organization);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.code === "VALIDATION_ERROR" && err.fieldErrors.length > 0) {
          setFieldError(err.fieldErrors[0].message);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Could not reach the server. Check your connection and try again.");
      }
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleClose() {
    if (!create.isPending) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setFormError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("Name cannot be empty");
      inputRef.current?.focus();
      return;
    }

    create.mutate(trimmed);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <dialog
      ref={ref}
      aria-labelledby="create-org-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface p-0 shadow-lg backdrop:bg-slate-900/40"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="p-5">
          <h2
            id="create-org-title"
            className="text-base font-semibold text-slate-900"
          >
            New organisation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            You will be added as an admin and switched to the new org immediately.
          </p>

          <div className="mt-4 space-y-3">
            <TextField
              ref={inputRef}
              label="Organisation name"
              placeholder="e.g. Acme Support"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              error={fieldError ?? undefined}
              disabled={create.isPending}
              autoComplete="off"
            />
            <FormError message={formError} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={create.isPending}
            type="button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
