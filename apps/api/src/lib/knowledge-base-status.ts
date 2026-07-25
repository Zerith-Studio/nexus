import { ApiError } from "@raas/shared";

/** ACTIVE-only, 404 otherwise — a KB mid-async-deletion (see DELETE
 * /kb/:id) is treated as already gone by every read/write path that
 * touches it, even though its rows still exist until the cleanup worker
 * finishes. */
export function assertActiveKnowledgeBase(knowledgeBase: { status: string } | null): void {
  if (!knowledgeBase || knowledgeBase.status !== "ACTIVE") {
    throw ApiError.notFound("Knowledge base not found");
  }
}
