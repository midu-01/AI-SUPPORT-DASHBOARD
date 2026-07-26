import Link from "next/link";
import { redirect } from "next/navigation";

import { ConversationDetail } from "@/components/conversations/conversation-detail";
import { serverApiFetch } from "@/lib/server-api";
import type { Conversation, Message } from "@/types/api";

/**
 * Conversation detail — server-fetches the conversation and its messages so the
 * first render is instant, then hands off to the client component for
 * interactivity (rename, delete, send message).
 */
export default async function ConversationDetailPage({
  params,
}: {
  // Next.js 16: `params` is a Promise. Synchronous access was removed in v16,
  // so it has to be awaited.
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let conversation: Conversation;
  let messages: Message[];

  try {
    [conversation, messages] = await Promise.all([
      serverApiFetch<Conversation>(`/conversations/${id}`),
      serverApiFetch<Message[]>(`/conversations/${id}/messages`),
    ]);
  } catch {
    // 404 or ownership violation — redirect rather than showing an error page
    // for a resource that doesn't exist (or isn't theirs).
    redirect("/conversations");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/conversations"
        className="text-sm font-medium text-brand hover:text-brand-hover"
      >
        ← All conversations
      </Link>

      <div className="mt-4">
        <ConversationDetail
          id={id}
          initial={conversation}
          initialMessages={messages}
        />
      </div>
    </div>
  );
}
