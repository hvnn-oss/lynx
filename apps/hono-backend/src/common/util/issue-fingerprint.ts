import { createHash } from "node:crypto";
import type {
  FingerprintValue,
  IssueFingerprintInput,
} from "../types/issue.js";

export function createStableIssueFingerprint(
  input: IssueFingerprintInput,
): string {
  return hash({
    agentId: normalizeRequired(input.agentId),
    category: input.category,
    detectorType: normalizeRequired(input.detectorType),
    environment: normalizeRequired(input.environment),
    failedTool: normalizeOptional(input.failedTool),
    policyId: normalizeOptional(input.policyId),
    reasonCode: normalizeOptional(input.reasonCode),
    tools: normalizeTools(input.tools),
  });
}

export function createExactOccurrenceFingerprint(
  input: IssueFingerprintInput,
  stableFingerprint = createStableIssueFingerprint(input),
): string {
  return hash({
    stableFingerprint,
    agentId: normalizeRequired(input.agentId),
    agentVersion: normalizeOptional(input.agentVersion),
    context: input.context ?? {},
    policyVersion: normalizeOptional(input.policyVersion),
    promptVersionId: normalizeOptional(input.promptVersionId),
  });
}

export function createIssueFingerprint(input: IssueFingerprintInput): string {
  return createExactOccurrenceFingerprint(input);
}

function hash(value: FingerprintValue): string {
  return createHash("sha256")
    .update(canonicalize(value), "utf8")
    .digest("hex");
}

export function canonicalize(value: FingerprintValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const fields = Object.entries(value)
    .filter(([, fieldValue]) => fieldValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(
      ([key, fieldValue]) =>
        `${JSON.stringify(key)}:${canonicalize(fieldValue)}`,
    );
  return `{${fields.join(",")}}`;
}

function normalizeTools(tools: string[] | undefined): string[] {
  return [...new Set((tools ?? []).map(normalizeRequired))].sort();
}

function normalizeRequired(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Issue fingerprint fields must not be empty");
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string {
  return value?.trim() ?? "";
}
