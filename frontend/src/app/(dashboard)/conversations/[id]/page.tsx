import Link from "next/link";

import { ConversationDetailLoader } from "@/components/conversations/conversation-detail-loader";

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

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/conversations"
        className="text-sm font-medium text-brand hover:text-brand-hover"
      >
        ← All conversations
      </Link>

      <div className="mt-4">
        <ConversationDetailLoader id={id} />
      </div>
    </div>
  );
}
