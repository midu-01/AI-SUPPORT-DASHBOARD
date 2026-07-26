import { FileText, MessageSquare, MessagesSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

interface Stat {
  label: string;
  value: number;
  icon: LucideIcon;
}

/**
 * Totals across the account. All three counts come from `/dashboard/summary`,
 * so this renders without a request of its own.
 */
export function StatRow({
  conversations,
  documents,
  messages,
}: {
  conversations: number;
  documents: number;
  messages: number;
}) {
  const stats: Stat[] = [
    { label: "Conversations", value: conversations, icon: MessagesSquare },
    { label: "Messages", value: messages, icon: MessageSquare },
    { label: "Documents", value: documents, icon: FileText },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="flex items-center gap-4 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            {/* Tabular figures so the numbers don't jitter as they change width. */}
            <span className="block text-2xl font-semibold tabular-nums text-slate-900">
              {value.toLocaleString()}
            </span>
            <span className="block truncate text-xs text-slate-500">{label}</span>
          </span>
        </Card>
      ))}
    </div>
  );
}
