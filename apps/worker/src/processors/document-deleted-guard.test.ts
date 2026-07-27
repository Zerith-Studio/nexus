/**
 * Regression coverage for a real production-audit finding: DELETE
 * /documents/:id soft-deletes a Document and hard-deletes its
 * DocumentChunk rows, but (before this fix) nothing stopped an
 * already-enqueued pipeline job from continuing to run against it — a
 * document deleted mid-QUEUED/PROCESSING could get its chunks recreated,
 * re-embedded (real billed provider cost), and its status flipped back to
 * READY, resurrecting content the user asked to remove.
 *
 * Each stage now checks for DELETED and throws DocumentDeletedError
 * (job-failure.ts) instead of doing its normal work — and, critically,
 * without calling failDocument, which would otherwise flip DELETED to
 * FAILED (a different but equally wrong resurrection). This file proves
 * each of the three stages that previously had no such guard now honors
 * it. extract-text's guard is exercised indirectly by pipeline.test.ts's
 * existing "already terminal status" coverage and isn't duplicated here.
 *
 * Prerequisites: docker compose up -d, migrations applied.
 */
import { randomUUID } from "node:crypto";

import { prisma, withTenantTransaction } from "@raas/db";
import type { EmbeddingProvider } from "@raas/providers";
import { JOB_NAMES, QUEUE_NAMES } from "@raas/shared";
import { FlowProducer, Queue, Worker, type Job } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { redisConnection } from "../lib/redis.js";
import type { ExtractedDocument } from "../lib/extract-pdf.js";
import { chunkTextProcessor } from "./chunk-text.js";
import { processEmbedChunksJob } from "./embed-chunks.js";
import { processDocumentProcessor } from "./process-document.js";
import type { DocumentJobData } from "./types.js";

const JOB_OPTS = {
  attempts: 1,
  failParentOnFailure: true,
};

async function waitForJobSettled(queue: Queue, jobId: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await queue.getJob(jobId);
    if (job) {
      const state = await job.getState();
      if (state === "completed" || state === "failed") return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`job ${jobId} did not settle within ${timeoutMs}ms`);
}

async function createDeletedDocument(organizationId: string, knowledgeBaseId: string): Promise<{ id: string }> {
  return withTenantTransaction(organizationId, (tx) =>
    tx.document.create({
      data: {
        organizationId,
        knowledgeBaseId,
        fileName: "deleted-mid-pipeline.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageKey: `${organizationId}/${knowledgeBaseId}/${randomUUID()}-deleted.pdf`,
        status: "DELETED",
        deletedAt: new Date(),
      },
    }),
  );
}

describe("pipeline stages skip work for a document deleted mid-flight", () => {
  const suffix = randomUUID().slice(0, 8);
  let organizationId: string;
  let knowledgeBaseId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: `Deleted Guard Org ${suffix}`, slug: `deleted-guard-org-${suffix}` },
    });
    organizationId = org.id;
    const kb = await withTenantTransaction(organizationId, (tx) =>
      tx.knowledgeBase.create({
        data: {
          organizationId,
          name: "Deleted Guard KB",
          embeddingProvider: "openai",
          embeddingModel: "text-embedding-3-small",
          embeddingDim: 1536,
        },
      }),
    );
    knowledgeBaseId = kb.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  });

  it("chunk-text: leaves a DELETED document alone instead of recreating its chunks", async () => {
    const document = await createDeletedDocument(organizationId, knowledgeBaseId);
    const data: DocumentJobData = { organizationId, documentId: document.id, knowledgeBaseId };

    const flowProducer = new FlowProducer({ connection: redisConnection });
    // chunk-text's own guard requires job.parent to be set (see
    // chunk-text.ts: "must run as part of the process-document flow"), so
    // the flow here mirrors ingestion-flow.ts's real production shape
    // exactly — process-document (root, queue=processing) -> chunk-text ->
    // extract-text — rather than making chunk-text a flow root itself. No
    // worker runs QUEUE_NAMES.processing: failParentOnFailure propagates
    // chunk-text's DocumentDeletedError up to process-document via BullMQ's
    // own Redis-side bookkeeping, which needs no active worker on the
    // parent's queue, and this test only cares whether chunk-text itself
    // did work.
    const extractionWorker = new Worker(
      QUEUE_NAMES.extraction,
      async (job) => (job.name === JOB_NAMES.extractText ? ({ pages: [{ pageNumber: 1, text: "hello world" }] } satisfies ExtractedDocument) : chunkTextProcessor(job)),
      { connection: redisConnection },
    );
    await extractionWorker.waitUntilReady();

    try {
      const chunkJobId = `${JOB_NAMES.chunkText}-${document.id}`;
      await flowProducer.add({
        name: JOB_NAMES.processDocument,
        queueName: QUEUE_NAMES.processing,
        data,
        opts: { ...JOB_OPTS, jobId: `${JOB_NAMES.processDocument}-${document.id}` },
        children: [
          {
            name: JOB_NAMES.chunkText,
            queueName: QUEUE_NAMES.extraction,
            data,
            opts: { ...JOB_OPTS, jobId: chunkJobId },
            children: [
              {
                name: JOB_NAMES.extractText,
                queueName: QUEUE_NAMES.extraction,
                data,
                opts: { ...JOB_OPTS, jobId: `${JOB_NAMES.extractText}-${document.id}` },
              },
            ],
          },
        ],
      });

      // Poll the chunk-text job itself, not its process-document parent —
      // it's the job under test, it settles before the parent does, and
      // nothing here processes QUEUE_NAMES.processing anyway.
      const extractionQueue = new Queue(QUEUE_NAMES.extraction, { connection: redisConnection });
      try {
        await waitForJobSettled(extractionQueue, chunkJobId);
      } finally {
        await extractionQueue.close();
      }
    } finally {
      await extractionWorker.close();
      await flowProducer.close();
    }

    const finalDocument = await withTenantTransaction(organizationId, (tx) => tx.document.findUnique({ where: { id: document.id } }));
    // Still DELETED — not resurrected to FAILED (the old failDocument
    // call would have done this) and no chunks were created.
    expect(finalDocument?.status).toBe("DELETED");
    const chunks = await withTenantTransaction(organizationId, (tx) => tx.documentChunk.findMany({ where: { documentId: document.id } }));
    expect(chunks).toHaveLength(0);
  }, 15_000);

  it("embed-chunks: skips the provider call and stays DELETED instead of flipping to FAILED", async () => {
    const document = await createDeletedDocument(organizationId, knowledgeBaseId);

    let providerCalls = 0;
    const neverCalledProvider: EmbeddingProvider = {
      async embed(texts: string[]) {
        providerCalls += 1;
        return texts.map(() => Array.from({ length: 1536 }, () => 0));
      },
    };

    const fakeJob = {
      id: `test-embed-deleted-${document.id}`,
      data: { organizationId, documentId: document.id, knowledgeBaseId, chunkIds: [randomUUID()] },
    } as unknown as Job<{ organizationId: string; documentId: string; knowledgeBaseId: string; chunkIds: string[] }>;

    await expect(
      processEmbedChunksJob(fakeJob, { getProvider: async () => neverCalledProvider, runPersistTransaction: withTenantTransaction }),
    ).rejects.toThrow(/deleted/i);

    expect(providerCalls).toBe(0);

    const finalDocument = await withTenantTransaction(organizationId, (tx) => tx.document.findUnique({ where: { id: document.id } }));
    expect(finalDocument?.status).toBe("DELETED");
  });

  it("process-document: does not flip a DELETED document back to READY or record usage for it", async () => {
    const document = await createDeletedDocument(organizationId, knowledgeBaseId);

    const fakeJob = {
      id: `test-process-deleted-${document.id}`,
      data: { organizationId, documentId: document.id, knowledgeBaseId },
      attemptsMade: 0,
      opts: { attempts: 1 },
    } as unknown as Job<DocumentJobData>;

    await processDocumentProcessor(fakeJob);

    const finalDocument = await withTenantTransaction(organizationId, (tx) => tx.document.findUnique({ where: { id: document.id } }));
    expect(finalDocument?.status).toBe("DELETED");
    expect(finalDocument?.processedAt).toBeNull();

    const usageEvents = await withTenantTransaction(organizationId, (tx) =>
      tx.usageEvent.findMany({ where: { type: "DOCUMENT_PROCESSED" } }),
    );
    expect(usageEvents.filter((e) => (e.metadata as Record<string, unknown>).documentId === document.id)).toHaveLength(0);
  });
});
