import pino, { type Logger } from "pino";

import type { LogBindings } from "./types.js";

export type { LogBindings } from "./types.js";
export type { Logger } from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const isProduction = process.env.NODE_ENV === "production";

// Defense in depth, not the only safeguard — every call site in this
// codebase is expected to never pass a password/token/API key/document
// content into a log call in the first place (LogBindings only ever
// carries requestId/organizationId/userId/job identifiers, never request
// bodies or file content wholesale). These paths exist so a future call
// site that DOES accidentally include one of these fields (e.g. logging
// `request.body`, a Prisma row, or an object that happens to carry a
// `password`/`token`/`hashedKey` property) gets it scrubbed rather than
// written to the log stream. pino's redact censors the value in place
// rather than dropping the field, so log shape/structure is unaffected.
//
// encryptedApiKey (OrganizationLlmConfig's BYO-provider key) and
// hashedKey (ApiKey's stored hash) are redacted the same as a raw
// password/token even though they're not directly usable on their own —
// ApiKey.prefix (the short, intentionally-safe-to-display identifier) is
// deliberately NOT in this list, since redacting it would hide the one
// piece of the row that's actually meant to be logged/shown.
//
// fast-redact (pino's redaction engine) has no recursive/any-depth
// wildcard — each nesting depth needs its own explicit `*` segment. Two
// levels of nesting (a field inside a logged object, or inside one
// further layer of wrapping, e.g. `{ organization: { llmConfig: {
// encryptedApiKey } } }`) covers every realistic accidental-log shape in
// this codebase without enumerating depths no call site actually
// produces.
// Exported so tests can build an equivalent pino instance against a
// captured stream to verify redaction actually happens, without pino's
// worker-thread `transport` (fixed at construction, not redirectable)
// getting in the way — see index.test.ts.
const SENSITIVE_FIELDS = ["password", "token", "apiKey", "encryptedApiKey", "hashedKey"];

export const REDACT_PATHS = [
  ...SENSITIVE_FIELDS,
  ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
  ...SENSITIVE_FIELDS.map((field) => `*.*.${field}`),
  "req.headers.authorization",
  "req.headers.cookie",
];

/**
 * Base process-wide logger. Prefer `createLogger()` for anything that has
 * request/tenant/user context to attach — this instance should only be
 * used for logging that happens outside of that context (process
 * startup/shutdown, top-level crash handlers).
 */
export const baseLogger: Logger = pino({
  level,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
});

/**
 * Creates a child logger bound with request/tenant/user context so every
 * log line it produces carries that context automatically, without every
 * call site having to repeat it.
 */
export function createLogger(bindings: LogBindings = {}): Logger {
  return baseLogger.child(bindings);
}
