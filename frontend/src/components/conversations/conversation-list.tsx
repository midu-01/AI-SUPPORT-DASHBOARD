"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MutationFeedback,
  mutationErrorMessage,
} from "@/components/ui/mutation-feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useOrgFetch } from "@/hooks/use-org-fetch";
import { useOrg } from "@/lib/org-context";
import { cn, formatDate } from "@/lib/utils";
import type { Conversation, PaginatedConversations } from "@/types/api";

// ── Query keys ──────────────────────────────────────────────────────────────

// orgId is part of the key so that switching org immediately invalidates the
// cache and triggers a fresh fetch scoped to the new org.
function conversationsKey(orgId: string | null, q: string, page: number) {
  return ["conversations", { orgId, q, page }] as const;
}

// ── Main component ──────────────────────────────────────────────────────────

export function ConversationList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId } = useOrg();
  const orgFetch = useOrgFetch();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search);

  // Reset to page 1 when the search query changes.
  const effectiveSearch = debouncedSearch.trim();
  const effectivePage = search !== debouncedSearch ? 1 : page;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: conversationsKey(orgId, effectiveSearch, effectivePage),
    queryFn: () =>
      orgFetch<PaginatedConversations>(
        `/conversations?q=${encodeURIComponent(effectiveSearch)}&page=${effectivePage}&size=20`,
      ),
    enabled: !!orgId,
  });

  // ── Create ──────────────────────────────────────────────────────────────

  const create = useMutation({
    mutationFn: () =>
      orgFetch<Conversation>("/conversations", {
        method: "POST",
        body: { title: "New conversation" },
      }),
    onSuccess: (created) => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/conversations/${created.id}`);
    },
    onError: (error) => {
      setMutationError(
        mutationErrorMessage(error, "Could not create the conversation. Try again."),
      );
    },
  });

  // ── Delete (optimistic) ─────────────────────────────────────────────────

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) =>
      orgFetch<void>(`/conversations/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });

      const key = conversationsKey(orgId, effectiveSearch, effectivePage);
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
    onError: (error, _id, context) => {
      // Roll back on failure.
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      setMutationError(
        mutationErrorMessage(error, "Could not delete the conversation. Try again."),
      );
    },
    onSuccess: () => setMutationError(null),
    onSettled: () => {
      setPendingDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // ── Confirm dialog ──────────────────────────────────────────────────────

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

  // Named in the confirmation so the user can see *which* conversation is about
  // to go. Falls back to the generic wording if the row has already left the
  // cache (the optimistic delete removes it before the request settles).
  const pendingDeleteTitle = data?.items.find(
    (c) => c.id === pendingDeleteId,
  )?.title;

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

      <MutationFeedback
        message={mutationError}
        onDismiss={() => setMutationError(null)}
      />

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
            "block w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-8 text-sm text-slate-900",
            "placeholder:text-slate-400",
          )}
          aria-label="Search conversations"
        />
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(""); setPage(1); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
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
                  {/* `subtle`, not `primary`: the page header already has a
                      primary "New conversation" button, and two filled brand
                      buttons on one screen compete instead of ranking. */}
                  <Button
                    variant="subtle"
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
                  <div className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-canvas">
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
                      size="icon"
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

      {/* Delete confirmation dialog. Rendered unconditionally — the native
          <dialog> has to be in the tree for `showModal()` to have something to
          call, so visibility is driven by `open`, not by mounting. */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete conversation?"
        description={
          pendingDeleteTitle
            ? `This will permanently delete "${pendingDeleteTitle}" and all its messages. This action cannot be undone.`
            : "This will permanently delete the conversation and all its messages. This action cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={executeDelete}
        onCancel={cancelDelete}
      />
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
          <div key={i} className="flex items-center justify-between px-4 py-3">
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
