import type { Job } from "bullmq";

import { getEmailProvider } from "../lib/email-provider.js";
import { createJobLogger } from "../lib/job-logger.js";

export interface SendEmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Checkpoint, not caller input — see module doc comment. */
  sent?: boolean;
}

/**
 * Generic transactional email delivery — apps/api builds the actual
 * message content (see apps/api/src/lib/email-templates.ts) and enqueues
 * it here; this processor only knows how to hand a fully-built message to
 * whichever EmailProvider is configured. Kept generic (not
 * signup-OTP-specific) so a future transactional email reuses this same
 * job/processor instead of adding a new one.
 *
 * Idempotent under retry, same checkpoint pattern as embed-chunks.ts: if
 * the provider call succeeds but the worker crashes (or anything else
 * throws) before this attempt finishes, BullMQ retries the job from
 * scratch — without a checkpoint that resends the same email. `sent` is
 * persisted onto the job's own Redis-backed data immediately after the
 * provider call returns, so a retry sees it and skips re-sending.
 */
export async function sendEmailProcessor(job: Job<SendEmailJobData>): Promise<void> {
  const log = createJobLogger({ jobId: job.id });
  if (job.data.sent) {
    log.info({ to: job.data.to }, "email already sent by a previous attempt of this job (idempotent retry)");
    return;
  }
  await getEmailProvider().send(job.data);
  await job.updateData({ ...job.data, sent: true });
  log.info({ to: job.data.to }, "email delivered");
}
