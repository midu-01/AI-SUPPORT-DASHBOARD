import { FileText, FileType, FileType2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";
import type { Document } from "@/types/api";

/**
 * Distinct icon per allowed type. Keyed on `mime_type` rather than on the
 * filename extension, because the extension is attacker-controlled — the
 * backend already stores a server-generated filename for the same reason.
 */
const ICON_BY_MIME: Record<string, LucideIcon> = {
  "application/pdf": FileType,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FileType2,
  "text/plain": FileText,
};

export function RecentDocuments({ items }: { items: Document[] }) {
  return (
    <Card>
      <CardHeader
        title="Recent documents"
        action={
          <Link
            href="/documents"
            className="text-xs font-medium text-brand hover:text-brand-hover"
          >
            View all
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          message="No documents uploaded yet."
          action={
            <Link
              href="/documents"
              className="text-sm font-medium text-brand hover:text-brand-hover"
            >
              Upload one
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((document) => {
            const Icon = ICON_BY_MIME[document.mime_type] ?? FileText;
            return (
              <li
                key={document.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {/* The name the user uploaded, not the UUID on disk. */}
                  <span className="block truncate text-sm text-slate-900">
                    {document.original_filename}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {formatBytes(document.size_bytes)} ·{" "}
                    <time dateTime={document.uploaded_at}>
                      {formatDate(document.uploaded_at)}
                    </time>
                  </span>
                </span>
                <StatusBadge status={document.status} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
