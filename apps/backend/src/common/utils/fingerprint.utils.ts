import { createHash } from 'crypto';
import stableStringify from 'json-stable-stringify';
import { isRecord } from './event-payload.utils';
import { toDebugString } from './debug-preview.utils';

export const createFailureSignature = (input: {
  eventType: string;
  label: string;
  model?: string;
  toolName?: string;
  error?: unknown;
  payload?: unknown;
}): string =>
  createStableFingerprint({
    eventType: input.eventType,
    label: normalizeLabel(input.label) || 'unlabeled',
    toolName: input.toolName ?? 'no-tool',
    model: input.model ?? 'no-model',
    error: normalizeError(input.error),
    payload: normalizeFingerprintPayload(input.payload),
  });

export const createStableFingerprint = (value: unknown): string => {
  const serialized = stableStringify(value) ?? JSON.stringify(value);
  return createHash('sha256').update(serialized).digest('hex').slice(0, 24);
};

const normalizeLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ':uuid',
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ':email')
    .replace(/https?:\/\/[^\s?]+(\?[^\s]+)?/gi, ':url')
    .replace(/\d+/g, ':number')
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);

const normalizeError = (value: unknown): string | undefined => {
  const raw = toDebugString(value);
  if (!raw) return undefined;
  return raw
    .toLowerCase()
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ':uuid',
    )
    .replace(/\d+/g, ':number')
    .slice(0, 160);
};

const normalizeFingerprintPayload = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (!isRecord(value)) return undefined;

  return {
    status: value.status,
    code: value.code,
    finishReason: value.finishReason,
    sideEffect: value.sideEffect,
    riskLevel: value.riskLevel,
  };
};
