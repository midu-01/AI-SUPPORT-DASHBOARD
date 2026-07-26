"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { apiFetch } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import type { Conversation, PaginatedConversations } from "@/types/api";

// ── Query keys ──────────────────────────────────────────────────────────────

function conversationsKey(q: string, page: number) {
  return ["conversations", { q, page }] as const;
}

// ── Main component ──────────────────────────────────────────────────────────

export function ConversationList() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  // Reset to page 1 when the search query changes.
  const effectiveSearch = debouncedSearch.trim();
  const effectivePage = search !== debouncedSearch ? 1 : page;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: conversationsKey(effectiveSearch, effectivePage),
    queryFn: () =>
      apiFetch<PaginatedConversations>(
        `/conversations?q=${encodeURIComponent(effectiveSearch)}&page=${effectivePage}&size=20`,
      ),
  });

  // ── Create ──────────────────────────────────────────────────────────────

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Conversation>("/conversations", {
        method: "POST",
        body: { title: "New conversation" },
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/conversations/${created.id}`);
    },
  });

  // ── Delete (optimistic) ─────────────────────────────────────────────────

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/conversations/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      // Cancel in-flight fetches so they don't overwrite the optimistic update.
      await queryClient.cancelQueries({ queryKey: ["conversations"] });

      const key = conversationsKey(effectiveSearch, effectivePage);
      const previous = queryClient.getQueryData<PaginatedConversations>(key);

      if (previous) {
        queryClient.setQueryData<PaginatedConversations>(key, {
          ...previous,
          items: previous.items.filter((c) => c.id !== id),
          total: previous.total - 1,
        });
      }

      return { previous, key };
    },
    onError: (_err, _id, context) => {
      // Roll back on failure.
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: () => {
      setPendingDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // ── Confirm dialog (native <dialog>) ────────────────────────────────────

  function confirmDelete(id: string) {
    setPendingDeleteId(id);
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  function executeDelete() {
    if (pendingDeleteId) {
      remove.mutate(pendingDeleteId);
    }
  }

  // ── Pagination helpers ──────────────────────────────────────────────────

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;
  const hasNext = effectivePage < totalPages;
  const hasPrev = effectivePage > 1;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Conversations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your support conversations.
          </p>
        </div>
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          size="sm"
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          New conversation
        </Button>
      </div>

      {/* Search */}
      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={cn(
            "block w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-3 text-sm text-slate-900",
            "placeholder:text-slate-400",
          )}
          aria-label="Search conversations"
        />
      </div>

      {/* List */}
      <div className="mt-4">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <Card>
            <EmptyState
              message={
                error instanceof Error
                  ? error.message
                  : "Failed to load conversations."
              }
            />
          </Card>
        ) : !data || data.items.length === 0 ? (
          <Card>
            <EmptyState
              message={
                effectiveSearch
                  ? `No conversations matching "${effectiveSearch}".`
                  : "No conversations yet."
              }
              action={
                !effectiveSearch ? (
                  <Button
                    size="sm"
                    onClick={() => create.mutate()}
                    loading={create.isPending}
                  >
                    Start one
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border" role="list">
              {data.items.map((conversation) => (
                <li key={conversation.id}>
                  <div className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                    <Link
                      href={`/conversations/${conversation.id}`}
                      className="min-w-0 flex-1"
                    >
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {conversation.title}
                      </span>
                      <time
                        dateTime={conversation.updated_at}
                        className="mt-0.5 block text-xs text-slate-500"
                      >
                        {formatDate(conversation.updated_at)}
                      </time>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirmDelete(conversation.id)}
                      aria-label={`Delete "${conversation.title}"`}
                    >
                      <Trash2 className="size-4 text-slate-400" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {effectivePage} of {totalPages} ({data?.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete conversation?"
          description="This will permanently delete the conversation and all its messages. This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={executeDelete}
          onCancel={cancelDelete}
          loading={remove.isPending}
        />
      )}
    </>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function ConversationListSkeleton() {
  return (
    <Card>
      <div className="divide-y divide-border" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading conversations…</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-8 rounded-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Confirm dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      aria-hidden="true"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p id="confirm-desc" className="mt-2 text-sm text-slate-600">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {loading ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
