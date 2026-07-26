import Link from "next/link";

import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { Conversation } from "@/types/api";

/**
 * The five most recently active conversations.
 *
 * "Recently active" is `updated_at` descending, which the backend bumps when a
 * message is added — so a thread someone is actually using rises to the top,
 * rather than one that merely has a recent title change.
 */
export function RecentConversations({ items }: { items: Conversation[] }) {
  return (
    <Card>
      <CardHeader
        title="Recent conversations"
        action={
          <Link
            href="/conversations"
            className="text-xs font-medium text-brand hover:text-brand-hover"
          >
            View all
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No conversations yet."
          action={
            <Link
              href="/conversations"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              Start one
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/conversations/${conversation.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="min-w-0 truncate text-sm text-slate-900">
                  {conversation.title}
                </span>
                {/* <time> carries the machine-readable value; the visible text
                    stays human. dateTime keeps the UTC instant intact. */}
                <time
                  dateTime={conversation.updated_at}
                  className="shrink-0 text-xs text-slate-500"
                >
                  {formatDate(conversation.updated_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
