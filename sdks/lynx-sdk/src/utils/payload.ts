import { createHash } from "crypto";
import type { LynxConfig, LynxEventType } from "../core/types.js";
import patternsConfig from "../config/patterns.json" with { type: "json" };

const RISK_PATTERNS = patternsConfig.riskPatterns.map(
  (item) => new RegExp(item.pattern, item.flags),
);

function getHash(data: any): string {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256")
    .update(str || "")
    .digest("hex")
    .slice(0, 16);
}

function extractRiskFlags(text: string): string[] {
  const flags: string[] = [];
  for (const pattern of RISK_PATTERNS) {
    if (pattern.test(text)) {
      const cleanPattern = pattern.source.replace(/\\/g, "");
      flags.push(cleanPattern);
    }
  }
  return flags;
}

function headTailTruncate(text: string, maxLen: number = 1000): string {
  if (text.length <= maxLen) return text;
  const reserve = 80; // space for indicator
  const half = Math.floor((maxLen - reserve) / 2);
  if (half <= 0) return "... [TRUNCATED] ...";
  const head = text.substring(0, half);
  const tail = text.substring(text.length - half);
  const truncatedCount = text.length - (head.length + tail.length);
  return `${head}... [TRUNCATED ${truncatedCount} CHARS] ...${tail}`;
}

const PII_RULES = patternsConfig.piiRules.map((rule) => ({
  name: rule.name,
  regex: new RegExp(rule.pattern, rule.flags),
  replacement: rule.replacement,
}));

const SENSITIVE_KEY_PATTERN =
  /(?:api[-_]?key|authorization|auth[-_]?token|bearer|client[-_]?secret|cookie|credential|jwt|password|private[-_]?key|refresh[-_]?token|secret|session[-_]?token|token)/i;

const SAFE_TOKEN_METRIC_KEYS = new Set([
  "completiontokens",
  "completiontokencount",
  "completion_tokens",
  "inputtokens",
  "inputtokencount",
  "input_tokens",
  "maxtokens",
  "maxoutputtokens",
  "max_tokens",
  "outputtokens",
  "outputtokencount",
  "output_tokens",
  "prompttokens",
  "prompttokencount",
  "prompt_tokens",
  "totaltokens",
  "totaltokencount",
  "total_tokens",
]);

function normalizeKey(key: string): string {
  return key.replace(/[-_]/g, "").toLowerCase();
}

const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;
const DEFAULT_SMART_DETAIL_LATENCY_MS = 10_000;
const CONTENT_KEYS = new Set([
  "arguments",
  "args",
  "data",
  "input",
  "output",
  "result",
]);
const SMART_DETAIL_EVENT_TYPES = new Set<LynxEventType>([
  "ERROR",
  "POLICY_VIOLATION",
  "GUARDRAIL_ACTIVATED",
  "LOOP_DETECTED",
]);

function isSensitiveKey(key: string): boolean {
  if (SAFE_TOKEN_METRIC_KEYS.has(normalizeKey(key))) {
    return false;
  }

  return SENSITIVE_KEY_PATTERN.test(key);
}

export function maskPIIString(text: string): string {
  let masked = text;
  for (const rule of PII_RULES) {
    masked = masked.replace(rule.regex, rule.replacement);
  }
  return masked;
}

export function recursiveMaskPII(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return maskPIIString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => recursiveMaskPII(item));
  }
  if (typeof obj === "object") {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (isSensitiveKey(key)) {
        res[key] = "[MASKED_SECRET]";
      } else {
        res[key] = recursiveMaskPII(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

export type PayloadProcessingContext = {
  eventType?: LynxEventType;
};

export function processPayload(
  payload: any,
  config: LynxConfig,
  context: PayloadProcessingContext = {},
): any {
  if (!payload || typeof payload !== "object") return payload;

  let copy: any;
  try {
    copy = JSON.parse(JSON.stringify(payload));
  } catch {
    return { error: "[Unserializable Payload]" };
  }

  // Apply PII masking to the copied payload before other operations
  copy = recursiveMaskPII(copy);

  if (config.captureInput === false && "input" in copy) {
    delete copy.input;
  }
  if (config.captureOutput === false && "output" in copy) {
    delete copy.output;
  }

  const mode = config.captureMode || "smart";

  let textToAnalyze = "";
  if (copy.input) {
    textToAnalyze +=
      typeof copy.input === "string" ? copy.input : JSON.stringify(copy.input);
  }
  if (copy.output) {
    textToAnalyze +=
      typeof copy.output === "string"
        ? copy.output
        : JSON.stringify(copy.output);
  }

  const riskFlags = textToAnalyze ? extractRiskFlags(textToAnalyze) : [];
  if (riskFlags.length > 0) {
    copy.riskFlags = riskFlags;
  }

  if (mode === "metadata-only") copy = convertContentToMetadata(copy);

  if (mode === "smart") {
    copy = shouldPreserveSmartDetails(copy, config, context)
      ? truncateStrings(copy, config.maxPayloadLength ?? 4_000)
      : convertContentToMetadata(copy);
  }

  if (mode === "full" && config.maxPayloadLength !== undefined) {
    copy = truncateStrings(copy, config.maxPayloadLength);
  }

  return enforcePayloadByteLimit(copy, config.maxPayloadBytes);
}

/** Replaces raw content fields with stable hashes and UTF-8 byte lengths. */
function convertContentToMetadata(payload: Record<string, any>): Record<string, any> {
  const result = { ...payload };
  for (const key of CONTENT_KEYS) {
    if (!(key in result)) continue;
    const value = result[key];
    const serialized = serializeValue(value);
    const hashKey = key === "input" ? "promptHash" : key === "output" ? "responseHash" : `${key}Hash`;
    const lengthKey = key === "input" ? "promptLength" : key === "output" ? "responseLength" : `${key}Length`;
    result[hashKey] ??= getHash(value);
    result[lengthKey] ??= Buffer.byteLength(serialized, "utf8");
    delete result[key];
  }
  return result;
}

/** Smart mode retains detail only when an operator is likely to investigate it. */
function shouldPreserveSmartDetails(
  payload: Record<string, any>,
  config: LynxConfig,
  context: PayloadProcessingContext,
): boolean {
  if (context.eventType && SMART_DETAIL_EVENT_TYPES.has(context.eventType)) return true;
  if (payload.error) return true;
  return (
    typeof payload.latency === "number" &&
    payload.latency >=
      (config.smartDetailLatencyThresholdMs ?? DEFAULT_SMART_DETAIL_LATENCY_MS)
  );
}

function truncateStrings(value: any, maxLength: number): any {
  if (typeof value === "string") return headTailTruncate(value, maxLength);
  if (Array.isArray(value)) return value.map((item) => truncateStrings(item, maxLength));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, truncateStrings(item, maxLength)]),
  );
}

/** Guarantees a final serialized byte ceiling, falling back to safe metadata. */
function enforcePayloadByteLimit(payload: Record<string, any>, configuredLimit?: number): Record<string, any> {
  const maxBytes = Math.max(1_024, configuredLimit ?? DEFAULT_MAX_PAYLOAD_BYTES);
  const originalBytes = getPayloadBytes(payload);
  if (originalBytes <= maxBytes) return payload;

  const metadataPayload = {
    ...convertContentToMetadata(payload),
    payloadTruncated: true,
    originalPayloadBytes: originalBytes,
  };
  if (getPayloadBytes(metadataPayload) <= maxBytes) return metadataPayload;

  const minimalPayload = createMinimalPayload(metadataPayload, originalBytes);
  if (getPayloadBytes(minimalPayload) <= maxBytes) return minimalPayload;
  return { payloadTruncated: true, originalPayloadBytes: originalBytes };
}

function createMinimalPayload(payload: Record<string, any>, originalBytes: number): Record<string, any> {
  const retainedKeys = [
    "argsHash",
    "cost",
    "error",
    "latency",
    "parentSpanId",
    "path",
    "phase",
    "provider",
    "riskFlags",
    "spanId",
    "usage",
  ];
  const result: Record<string, any> = {
    payloadTruncated: true,
    originalPayloadBytes: originalBytes,
  };
  for (const key of retainedKeys) {
    if (key in payload) result[key] = truncateStrings(payload[key], 512);
  }
  return result;
}

function serializeValue(value: any): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "[Unserializable Payload]";
  }
}

function getPayloadBytes(payload: Record<string, any>): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}
