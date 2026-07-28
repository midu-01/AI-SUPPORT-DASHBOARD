"use client";

import { X } from "lucide-react";

import { ApiError } from "@/lib/api-client";

export function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function MutationFeedback({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-red-400 hover:text-red-600"
        aria-label="Dismiss error"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
