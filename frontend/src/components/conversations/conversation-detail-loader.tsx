"use client";

import { useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  ConversationDetail,
  ConversationDetailSkeleton,
} from "@/components/conversations/conversation-detail";
import { useOrgFetch } from "@/hooks/use-org-fetch";
import { useOrg } from "@/lib/org-context";
import type { Conversation, Message } from "@/types/api";

export function ConversationDetailLoader({ id }: { id: string }) {
  const router = useRouter();
  const orgFetch = useOrgFetch();
  const { orgId, isLoading: isOrgLoading } = useOrg();

  const [conversationQuery, messagesQuery] = useQueries({
    queries: [
      {
        queryKey: ["conversation", orgId, id],
        queryFn: () => orgFetch<Conversation>(`/conversations/${id}`),
        enabled: Boolean(orgId),
      },
      {
        queryKey: ["messages", orgId, id],
        queryFn: () => orgFetch<Message[]>(`/conversations/${id}/messages`),
        enabled: Boolean(orgId),
      },
    ],
  });

  const hasError = conversationQuery.isError || messagesQuery.isError;
  useEffect(() => {
    if (hasError) router.replace("/conversations");
  }, [hasError, router]);

  if (
    isOrgLoading ||
    !orgId ||
    conversationQuery.isLoading ||
    messagesQuery.isLoading ||
    hasError ||
    !conversationQuery.data ||
    !messagesQuery.data
  ) {
    return <ConversationDetailSkeleton />;
  }

  return (
    <ConversationDetail
      key={`${orgId}:${id}`}
      id={id}
      initial={conversationQuery.data}
      initialMessages={messagesQuery.data}
    />
  );
}
