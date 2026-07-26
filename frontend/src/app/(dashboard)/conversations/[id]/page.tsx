import Link from "next/link";

/**
 * Placeholder — the message thread, composer, rename, and delete arrive in
 * Step 10. It exists now so the dashboard's "recent conversations" links resolve
 * instead of 404ing.
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
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
        Conversation
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        The message thread for <code className="font-mono text-xs">{id}</code>{" "}
        arrives in the next step.
      </p>
    </div>
  );
}
