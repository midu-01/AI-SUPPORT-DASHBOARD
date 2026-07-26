"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FileType,
  FileType2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api-client";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import type { Document } from "@/types/api";

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — mirrors backend
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "text/plain": ".txt",
};
const ACCEPT = Object.values(ALLOWED_TYPES).join(",");

const ICON_BY_MIME: Record<string, LucideIcon> = {
  "application/pdf": FileType,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FileType2,
  "text/plain": FileText,
};

// ── Main component ──────────────────────────────────────────────────────────

export function DocumentManager() {
  const queryClient = useQueryClient();

  // ── List query ──────────────────────────────────────────────────────────

  const { data: documents, isLoading, isError, error } = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiFetch<Document[]>("/documents"),
  });

  // ── Upload ──────────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<Document>("/documents", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setUploadError(err.message);
      } else {
        setUploadError("Upload failed. Please try again.");
      }
    },
  });

  /** Client-side pre-validation, then hand to the mutation. */
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];

      // Type check
      if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
        setUploadError(
          `"${file.name}" is not an allowed type. Upload PDF, DOCX, or TXT files.`,
        );
        return;
      }

      // Size check
      if (file.size > MAX_SIZE_BYTES) {
        setUploadError(
          `"${file.name}" is ${formatBytes(file.size)}. The limit is 10 MB.`,
        );
        return;
      }

      if (file.size === 0) {
        setUploadError(`"${file.name}" is empty.`);
        return;
      }

      setUploadError(null);
      upload.mutate(file);
    },
    [upload],
  );

  // ── Drag-and-drop handlers ──────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  // ── Delete (optimistic) ─────────────────────────────────────────────────

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["documents"] });
      const previous = queryClient.getQueryData<Document[]>(["documents"]);
      if (previous) {
        queryClient.setQueryData<Document[]>(
          ["documents"],
          previous.filter((d) => d.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["documents"], context.previous);
      }
    },
    onSettled: () => {
      setPendingDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Documents
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload and manage your support documents.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload a document — drag and drop or click to browse"
        className={cn(
          "mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragActive
            ? "border-brand bg-indigo-50"
            : "border-border bg-slate-50 hover:border-slate-400",
          upload.isPending && "pointer-events-none opacity-60",
        )}
      >
        <Upload
          className={cn(
            "size-8",
            dragActive ? "text-brand" : "text-slate-400",
          )}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-slate-700">
            {upload.isPending
              ? "Uploading…"
              : dragActive
                ? "Drop file here"
                : "Drag & drop a file, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            PDF, DOCX, or TXT — up to 10 MB
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so the same file can be re-selected.
            e.target.value = "";
          }}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Upload error toast */}
      {uploadError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="flex-1">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="shrink-0 text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Document table */}
      <div className="mt-5">
        {isLoading ? (
          <DocumentTableSkeleton />
        ) : isError ? (
          <Card>
            <EmptyState
              message={
                error instanceof Error
                  ? error.message
                  : "Failed to load documents."
              }
            />
          </Card>
        ) : !documents || documents.length === 0 ? (
          <Card>
            <EmptyState message="No documents uploaded yet." />
          </Card>
        ) : (
          <Card>
            {/* Header row — hidden on mobile, visible md+ */}
            <div className="hidden border-b border-border px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-slate-500 md:grid md:grid-cols-[1fr_80px_80px_100px_80px_40px]">
              <span>Name</span>
              <span>Type</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span>Status</span>
              <span />
            </div>

            <ul className="divide-y divide-border" role="list">
              {documents.map((doc) => {
                const Icon = ICON_BY_MIME[doc.mime_type] ?? FileText;
                const ext =
                  ALLOWED_TYPES[doc.mime_type]?.replace(".", "").toUpperCase() ??
                  "FILE";

                return (
                  <li
                    key={doc.id}
                    className="grid items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors hover:bg-slate-50 md:grid-cols-[1fr_80px_80px_100px_80px_40px]"
                  >
                    {/* Name */}
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon
                        className="size-4 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {doc.original_filename}
                      </span>
                    </div>

                    {/* Type badge */}
                    <span className="inline-flex w-fit items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {ext}
                    </span>

                    {/* Size */}
                    <span className="text-xs text-slate-500">
                      {formatBytes(doc.size_bytes)}
                    </span>

                    {/* Date */}
                    <time
                      dateTime={doc.uploaded_at}
                      className="text-xs text-slate-500"
                    >
                      {formatDate(doc.uploaded_at)}
                    </time>

                    {/* Status */}
                    <StatusBadge status={doc.status} />

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(doc.id)}
                      aria-label={`Delete "${doc.original_filename}"`}
                    >
                      <Trash2
                        className="size-4 text-slate-400"
                        aria-hidden="true"
                      />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>

      {/* Delete confirmation */}
      {pendingDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPendingDeleteId(null)}
          aria-hidden="true"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-doc-title"
            aria-describedby="delete-doc-desc"
            className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-doc-title"
              className="text-base font-semibold text-slate-900"
            >
              Delete document?
            </h2>
            <p id="delete-doc-desc" className="mt-2 text-sm text-slate-600">
              This will permanently remove the document and its file. This
              action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (pendingDeleteId) remove.mutate(pendingDeleteId);
                }}
                loading={remove.isPending}
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function DocumentTableSkeleton() {
  return (
    <Card>
      <div
        className="divide-y divide-border"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading documents…</span>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3"
          >
            <Skeleton className="size-4 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}
