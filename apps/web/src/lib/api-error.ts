import type { ApiErrorBody, ApiErrorCode } from "@/lib/types";

// Used only when the server response is missing its own `message` (an
// already-unusual case) — keyed by the real error code so the fallback at
// least tells the user something specific to what happened, rather than one
// blanket "something went wrong" for a 401 and a 500 alike.
const FALLBACK_MESSAGES: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "That request wasn't valid. Please check your input and try again.",
  VALIDATION_ERROR: "Some of the information provided wasn't valid. Please check your input and try again.",
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  CONFLICT: "That conflicts with something that already exists.",
  RATE_LIMIT_EXCEEDED: "You're making requests too quickly. Please wait a moment and try again.",
  INTERNAL_ERROR: "Our server ran into a problem handling that. Please try again.",
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId: string | undefined;
  readonly details: { path: string; message: string }[] | undefined;

  constructor(status: number, body: Partial<ApiErrorBody["error"]>) {
    const code = body.code ?? "INTERNAL_ERROR";
    super(body.message ?? FALLBACK_MESSAGES[code]);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
