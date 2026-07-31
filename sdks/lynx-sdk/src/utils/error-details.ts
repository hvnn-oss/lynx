import { createStableHash } from "./stable-hash.js";

export interface LynxErrorDetails {
  errorName: string;
  errorCode: string;
  errorMessage: string;
  errorSignature: string;
}

/** Extracts bounded error evidence and a stable signature without exposing stack paths. */
export function readErrorDetails(
  error: unknown,
  fallbackCode: string,
): LynxErrorDetails {
  const errorName =
    error instanceof Error && error.name ? error.name : "UnknownError";
  const errorCode = normalizeErrorCode(readErrorCode(error), fallbackCode);
  const errorMessage =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const stackFrame = readNormalizedStackFrame(error);

  return {
    errorName,
    errorCode,
    errorMessage: errorMessage.slice(0, 1_000),
    errorSignature: createStableHash({
      errorName,
      errorCode,
      stackFrame,
    }),
  };
}

/** Normalizes provider and application error codes before grouping. */
export function normalizeErrorCode(
  value: unknown,
  fallback: string,
): string {
  const raw =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : fallback;
  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_.-]+/g, "_")
    .slice(0, 80);
  return normalized || fallback;
}

/** Reads a provider error code without depending on its variable message. */
function readErrorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return error.code;
}

/** Keeps only a hashed, line-number-independent stack frame in the signature. */
function readNormalizedStackFrame(error: unknown): string {
  if (!(error instanceof Error) || !error.stack) return "";
  const frame = error.stack
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .find(Boolean);
  return (frame ?? "")
    .replaceAll("\\", "/")
    .replace(/:\d+:\d+(?=\)?$)/, "")
    .slice(-320);
}
