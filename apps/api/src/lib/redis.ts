import { createLogger } from "@raas/logger";
import { Redis } from "ioredis";

import { env } from "../env.js";

const logger = createLogger({ service: "api", component: "redis" });

// Session revocation store — this is the ONLY thing in this codebase that
// makes packages/auth's stateless JWT verification into a real, revocable
// session. packages/auth itself never touches Redis; only apps/api does
// (see lib/session.ts). Not shared with apps/worker's own Redis
// connection — each process owns its own client.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
  // ioredis retries connecting on its own (default backoff strategy) —
  // this listener must exist regardless, since an unhandled "error" event
  // with no listener crashes the process (index.ts's uncaughtException
  // handler would then tear down the whole API on a transient Redis blip).
  // Mirrors apps/worker/src/lib/redis.ts's identical listener.
  logger.warn({ err }, "redis connection error — ioredis will retry automatically");
});
