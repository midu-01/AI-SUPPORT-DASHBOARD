"use client";

/**
 * Modal for inviting a new member to the active organisation by email.
 *
 * Built on the native <dialog> element — same pattern as CreateOrgDialog.
 * Only admins can invite; the backend enforces this, and the UI hides the
 * trigger for non-admins as a courtesy (not a security boundary).
 *
 * On success the members query is invalidated so the list refreshes, and the
 * form resets for another invite.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { CONTROL_BASE, controlBorder } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";
import { useOrgFetch } from "@/hooks/use-org-fetch";
import { useOrg } from "@/lib/org-context";
import { ApiError } from "@/lib/api-client";
import type { Membership, OrgRole } from "@/types/api";

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
}

export function InviteMemberDialog({ open, onClose }: InviteMemberDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const orgFetch = useOrgFetch();
  const { orgId } = useOrg();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Open / close sync ────────────────────────────────────────────────────

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setEmail("");
      setRole("member");
      setFieldError(null);
      setFormError(null);
      el.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!invite.isPending) handleClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mutation ─────────────────────────────────────────────────────────────

  const invite = useMutation({
    mutationFn: (data: { email: string; role: OrgRole }) =>
      orgFetch<Membership>(`/organizations/${orgId}/members/invite`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
      // Reset for another invite instead of closing — admins often add
      // multiple people in a row.
      setEmail("");
      setRole("member");
      setFieldError(null);
      setFormError("Member invited successfully!");
      requestAnimationFrame(() => inputRef.current?.focus());
      // Clear the success message after a moment.
      setTimeout(() => setFormError(null), 3000);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.code === "USER_NOT_FOUND") {
          setFieldError("No registered user with that email address");
        } else if (err.code === "ALREADY_MEMBER") {
          setFieldError("This user is already a member of the organisation");
        } else if (err.code === "FORBIDDEN") {
          setFormError("Only admins can invite members");
        } else if (err.code === "VALIDATION_ERROR" && err.fieldErrors.length > 0) {
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
    if (!invite.isPending) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setFormError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Email cannot be empty");
      inputRef.current?.focus();
      return;
    }

    // Basic email format check — the backend validates with Pydantic's EmailStr
    // anyway, but catching obvious mistakes saves a round-trip.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError("Please enter a valid email address");
      inputRef.current?.focus();
      return;
    }

    invite.mutate({ email: trimmed, role });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <dialog
      ref={ref}
      aria-labelledby="invite-member-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface p-0 shadow-lg backdrop:bg-slate-900/40"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="p-5">
          <h2
            id="invite-member-title"
            className="text-base font-semibold text-slate-900"
          >
            Invite member
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a registered user to this organisation by their email address.
          </p>

          <div className="mt-4 space-y-3">
            <TextField
              ref={inputRef}
              label="Email address"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              error={fieldError ?? undefined}
              disabled={invite.isPending}
              autoComplete="email"
            />

            <div className="space-y-1.5">
              <label
                htmlFor="invite-role"
                className="block text-sm font-medium text-fg"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
                disabled={invite.isPending}
                className={cn(CONTROL_BASE, controlBorder(), "h-11 sm:h-10")}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {formError && (
              <div
                role="alert"
                className={
                  formError.includes("successfully")
                    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                    : "rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger"
                }
              >
                {formError}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={invite.isPending}
            type="button"
          >
            Close
          </Button>
          <Button type="submit" loading={invite.isPending}>
            {invite.isPending ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
