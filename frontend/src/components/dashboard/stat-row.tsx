import { FileText, MessageSquare, MessagesSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
// Aliased: this file already has a local `Stat` type for its row data, and the
// primitive is the more likely thing to be renamed later.
import { Stat as StatDisplay } from "@/components/ui/stat";

interface Stat {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Domain hue — drives both the icon tile and the card's accent rule. */
  tone: "conversations" | "documents";
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
  // Each stat carries its domain hue, so the row is scannable by colour before
  // any label is read. Messages belong to the conversations domain — they are not
  // a fourth area, and inventing a hue for them would imply they were.
  const stats: Stat[] = [
    {
      label: "Conversations",
      value: conversations,
      icon: MessagesSquare,
      tone: "conversations",
    },
    {
      label: "Messages",
      value: messages,
      icon: MessageSquare,
      tone: "conversations",
    },
    { label: "Documents", value: documents, icon: FileText, tone: "documents" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon, tone }) => (
        <Card
          key={label}
          accent={tone}
          className="flex items-center gap-4 p-4"
        >
          <IconTile icon={icon} tone={tone} />
          <StatDisplay label={label} value={value.toLocaleString()} />
        </Card>
      ))}
    </div>
  );
}
