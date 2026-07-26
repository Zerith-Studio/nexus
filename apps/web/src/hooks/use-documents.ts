import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeDocument,
  deleteDocument,
  listDocuments,
  retryDocument,
  uploadToPresignedUrl,
} from "@/lib/api/documents";
import { presignDocument } from "@/lib/api/knowledge-bases";
import type { Document } from "@/lib/types";

const ACTIVE_STATUSES = new Set<Document["status"]>(["QUEUED", "PROCESSING"]);

export function documentKeys(knowledgeBaseId: string) {
  return ["documents", knowledgeBaseId] as const;
}

// Deliberately a child of documentKeys(id), not a sibling — invalidating
// documentKeys(id) (every mutation below already does this) prefix-matches
// this key too, so upload/delete/retry keep the paginated list in sync
// for free, with no changes needed to those mutations' onSuccess handlers.
function infiniteDocumentKeys(knowledgeBaseId: string) {
  return [...documentKeys(knowledgeBaseId), "infinite"] as const;
}

export function useDocuments(knowledgeBaseId: string, organizationId: string, limit?: number) {
  return useQuery({
    queryKey: limit ? [...documentKeys(knowledgeBaseId), { limit }] : documentKeys(knowledgeBaseId),
    queryFn: () => listDocuments(knowledgeBaseId, organizationId, undefined, limit),
    enabled: Boolean(knowledgeBaseId && organizationId),
    refetchInterval: (query) => {
      const documents = query.state.data?.data ?? [];
      return documents.some((doc) => ACTIVE_STATUSES.has(doc.status)) ? 3_000 : false;
    },
  });
}

/**
 * Cursor-paginated document list for DocumentsTable — "Load more", not
 * page 1 only. Polls (same 3s interval and QUEUED/PROCESSING trigger as
 * useDocuments) across every page already loaded, not just the first,
 * so a status flip on a document from page 2+ still shows up live.
 */
export function useInfiniteDocuments(knowledgeBaseId: string, organizationId: string) {
  return useInfiniteQuery({
    queryKey: infiniteDocumentKeys(knowledgeBaseId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listDocuments(knowledgeBaseId, organizationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(knowledgeBaseId && organizationId),
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const anyActive = pages.some((page) => page.data.some((doc) => ACTIVE_STATUSES.has(doc.status)));
      return anyActive ? 3_000 : false;
    },
  });
}

export interface UploadDocumentVariables {
  file: File;
  onProgress?: (percent: number) => void;
}

export function useUploadDocument(knowledgeBaseId: string, organizationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadDocumentVariables) => {
      const { document, uploadUrl } = await presignDocument(knowledgeBaseId, {
        organizationId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      await uploadToPresignedUrl(uploadUrl, file, onProgress);
      onProgress?.(100);
      return completeDocument(document.id, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys(knowledgeBaseId) });
    },
  });
}

export function useDeleteDocument(knowledgeBaseId: string, organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys(knowledgeBaseId) });
    },
  });
}

export function useRetryDocument(knowledgeBaseId: string, organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryDocument(id, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys(knowledgeBaseId) });
    },
  });
}
