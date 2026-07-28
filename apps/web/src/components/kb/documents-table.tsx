"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import {
  Loader2Icon,
  MoreHorizontalIcon,
  RotateCwIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentStatusBadge } from "@/components/kb/document-status-badge";
import { useDeleteDocument, useRetryDocument } from "@/hooks/use-documents";
import { fadeUp } from "@/lib/motion";
import { formatBytes } from "@/lib/utils";
import type { Document, DocumentStatus } from "@/lib/types";

const STATUS_FILTERS: { value: DocumentStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "READY", label: "Ready" },
  { value: "PROCESSING", label: "Processing" },
  { value: "QUEUED", label: "Queued" },
  { value: "FAILED", label: "Failed" },
];

export function DocumentsTable({
  documents,
  knowledgeBaseId,
  organizationId,
  hasNextPage = false,
  isFetchingNextPage = false,
  isLoadMoreError = false,
  onLoadMore,
}: {
  documents: Document[];
  knowledgeBaseId: string;
  organizationId: string;
  /** Pagination — all optional so this component still works standalone
   * (e.g. in a future context with a fully-loaded, unpaginated list)
   * without every caller having to wire through pagination it doesn't have. */
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  /** True when the most recent fetchNextPage() call failed — distinct
   * from the initial-load error, which the page-level ErrorState already
   * owns (see kb/[id]/page.tsx). Retrying is just calling onLoadMore
   * again; react-query's fetchNextPage doesn't need special reset. */
  isLoadMoreError?: boolean;
  onLoadMore?: () => void;
}) {
  const retryDocument = useRetryDocument(knowledgeBaseId, organizationId);
  const deleteDocument = useDeleteDocument(knowledgeBaseId, organizationId);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileName: string } | null>(null);
  const reducedMotion = useReducedMotion();

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDocument.mutateAsync(deleteTarget.id);
      toast.success("Document deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Couldn't delete document. Please try again.");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (statusFilter !== "all" && document.status !== statusFilter) return false;
      if (q && !document.fileName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, query, statusFilter]);

  // Filtering only ever runs over documents already fetched — a match on
  // an unloaded page can't show up yet. Surfaced only once there's both a
  // narrowing filter active AND more to load, so it doesn't clutter the
  // common case (no filter, or already-exhaustive list).
  const filterMayBeIncomplete = hasNextPage && (query.trim() !== "" || statusFilter !== "all");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DocumentStatus | "all")}>
          <SelectTrigger size="sm" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={SearchXIcon}
            title="No matching documents"
            description={
              filterMayBeIncomplete
                ? "No matches in what's loaded so far — load more to keep searching, or try a different term."
                : "Try a different search term or status filter."
            }
            action={
              filterMayBeIncomplete && onLoadMore ? (
                <Button variant="outline" onClick={onLoadMore} disabled={isFetchingNextPage}>
                  {isFetchingNextPage && <Loader2Icon className="animate-spin" />}
                  {isLoadMoreError ? "Try again" : "Load more"}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((document) => (
          <TableRow key={document.id}>
            <TableCell className="max-w-72 truncate font-medium" title={document.fileName}>
              {document.fileName}
            </TableCell>
            <TableCell>
              <DocumentStatusBadge status={document.status} />
              {document.status === "FAILED" && document.failureReason && (
                <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground" title={document.failureReason}>
                  {document.failureReason}
                </p>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{formatBytes(document.sizeBytes)}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Document actions">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {document.status === "FAILED" && (
                    <DropdownMenuItem
                      onSelect={() =>
                        toast.promise(retryDocument.mutateAsync(document.id), {
                          loading: "Retrying…",
                          success: "Document queued for retry",
                          error: "Couldn't retry document",
                        })
                      }
                    >
                      <RotateCwIcon /> Retry
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteTarget({ id: document.id, fileName: document.fileName })}
                  >
                    <TrashIcon /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {filtered.length > 0 && filterMayBeIncomplete && (
        <p className="px-3 pb-1 text-xs text-muted-foreground">
          Showing matches from what&apos;s loaded so far — load more to search the rest.
        </p>
      )}

      {filtered.length > 0 && (hasNextPage || isLoadMoreError) && onLoadMore && (
        <motion.div
          initial={reducedMotion ? false : "hidden"}
          animate="show"
          variants={fadeUp}
          className="flex flex-col items-center gap-2 border-t border-border px-3 py-4"
        >
          {isLoadMoreError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <TriangleAlertIcon className="size-3.5 shrink-0" /> Couldn&apos;t load more documents.
            </p>
          )}
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingNextPage} className="w-full sm:w-auto">
            {isFetchingNextPage && <Loader2Icon className="animate-spin" />}
            {isFetchingNextPage ? "Loading…" : isLoadMoreError ? "Try again" : "Load more"}
          </Button>
        </motion.div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete document"
        description={
          <>
            This permanently deletes{" "}
            <strong className="text-foreground">{deleteTarget?.fileName}</strong> and removes it from every future
            chat response. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        isPending={deleteDocument.isPending}
      />
    </div>
  );
}
