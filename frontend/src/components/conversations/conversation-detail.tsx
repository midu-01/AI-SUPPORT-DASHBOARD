"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MutationFeedback,
  mutationErrorMessage,
} from "@/components/ui/mutation-feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgFetch } from "@/hooks/use-org-fetch";
import { useOrg } from "@/lib/org-context";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type { Conversation, Message } from "@/types/api";

// ── Props ───────────────────────────────────────────────────────────────────

interface ConversationDetailProps {
  id: string;
  /** Server-fetched conversation — avoids a loading flash on first render. */
  initial: Conversation;
  /** Server-fetched messages — same reason. */
  initialMessages: Message[];
}

// ── Main component ──────────────────────────────────────────────────────────

export function ConversationDetail({
  id,
  initial,
  initialMessages,
}: ConversationDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgFetch = useOrgFetch();
  const { orgId } = useOrg();
  const conversationKey = ["conversation", orgId, id] as const;
  const messagesKey = ["messages", orgId, id] as const;
  const [mutationError, setMutationError] = useState<string | null>(null);

  // ── Conversation query (seeded with server data) ────────────────────────

  const { data: conversation } = useQuery({
    queryKey: conversationKey,
    queryFn: () => orgFetch<Conversation>(`/conversations/${id}`),
    initialData: initial,
  });

  // ── Messages query (seeded with server data) ───────────────────────────

  const { data: messages = [] } = useQuery({
    queryKey: messagesKey,
    queryFn: () => orgFetch<Message[]>(`/conversations/${id}/messages`),
    initialData: initialMessages,
  });

  // ── Rename (inline, optimistic) ─────────────────────────────────────────

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const rename = useMutation({
    mutationFn: (title: string) =>
      orgFetch<Conversation>(`/conversations/${id}`, {
        method: "PATCH",
        body: { title },
      }),
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: conversationKey });
      const previous = queryClient.getQueryData<Conversation>(conversationKey);
      if (previous) {
        queryClient.setQueryData<Conversation>(conversationKey, {
          ...previous,
          title,
        });
      }
      return { previous };
    },
    onError: (error, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(conversationKey, context.previous);
        setRenameValue(context.previous.title);
      }
      setMutationError(
        mutationErrorMessage(error, "Could not rename the conversation. Try again."),
      );
    },
    onSuccess: () => setMutationError(null),
    onSettled: () => {
      setIsRenaming(false);
      queryClient.invalidateQueries({ queryKey: conversationKey });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function submitRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === conversation.title) {
      setIsRenaming(false);
      setRenameValue(conversation.title);
      return;
    }
    rename.mutate(trimmed);
  }

  function cancelRename() {
    setIsRenaming(false);
    setRenameValue(conversation.title);
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const remove = useMutation({
    mutationFn: () =>
      orgFetch<void>(`/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.replace("/conversations");
    },
    onError: (error) => {
      setMutationError(
        mutationErrorMessage(error, "Could not delete the conversation. Try again."),
      );
      setShowDeleteConfirm(false);
    },
  });

  // ── Send message ────────────────────────────────────────────────────────

  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea as the user types.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const send = useMutation({
    mutationFn: (content: string) =>
      orgFetch<Message>(`/conversations/${id}/messages`, {
        method: "POST",
        body: { content, role: "user" },
      }),
    onSuccess: () => {
      setMutationError(null);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: messagesKey });
      queryClient.invalidateQueries({ queryKey: conversationKey });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      setMutationError(
        mutationErrorMessage(error, "Could not send the message. Try again."),
      );
    },
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || send.isPending) return;
    send.mutate(trimmed);
  }

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3">
        {isRenaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
            className="flex flex-1 items-center gap-2"
          >
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelRename();
              }}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-slate-900"
              aria-label="Conversation title"
            />
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Save title"
            >
              {/* emerald, not green: `StatusBadge` already established emerald
                  as the affirmative colour, and two greens is one too many. */}
              <Check className="size-4 text-emerald-600" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={cancelRename}
              aria-label="Cancel rename"
            >
              <X className="size-4 text-slate-400" aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-slate-900">
              {conversation.title}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setRenameValue(conversation.title);
                setIsRenaming(true);
              }}
              aria-label="Rename conversation"
            >
              <Pencil className="size-4 text-slate-400" aria-hidden="true" />
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete conversation"
        >
          <Trash2 className="size-4 text-slate-400" aria-hidden="true" />
        </Button>
      </div>

      <p className="mt-1 text-sm text-slate-600">
        Created {formatDate(conversation.created_at)}
      </p>

      <MutationFeedback
        message={mutationError}
        onDismiss={() => setMutationError(null)}
      />

      {/* Message thread */}
      <Card className="mt-5 flex flex-col" style={{ minHeight: "24rem" }}>
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState message="No messages yet. Start the conversation below." />
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-brand text-white"
                        : "bg-slate-100 text-slate-900",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <time
                      dateTime={msg.created_at}
                      className={cn(
                        "mt-1 block text-xs",
                        msg.role === "user"
                          ? "text-white/70"
                          : "text-slate-500",
                      )}
                    >
                      {formatDateTime(msg.created_at)}
                    </time>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="flex items-end gap-2 border-t border-border p-4"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-lg border border-border bg-surface px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            aria-label="Message"
            disabled={send.isPending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!draft.trim() || send.isPending}
            loading={send.isPending}
          >
            <Send className="size-4" aria-hidden="true" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </Card>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete conversation?"
        description={`This will permanently delete "${conversation.title}" and all its messages. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

export function ConversationDetailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading conversation…</span>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-2 h-4 w-32" />
      <Card className="mt-5" style={{ minHeight: "24rem" }}>
        <CardBody className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}
            >
              <Skeleton
                className={cn(
                  "h-16 rounded-xl",
                  i % 2 === 0 ? "w-3/5" : "w-2/5",
                )}
              />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
