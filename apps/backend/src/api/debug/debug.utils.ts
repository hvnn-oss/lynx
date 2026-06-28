import type { EventEntity } from '@repo/database';
import type { DebugSeverity } from '@repo/dto';

type LynxRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EventPayload = Record<string, unknown>;

export type DebugIssueType =
  | 'RUNTIME_ERROR'
  | 'POLICY_BLOCK'
  | 'TOOL_FAILURE'
  | 'HIGH_LATENCY'
  | 'MEMORY_MISS'
  | 'STALE_MEMORY'
  | 'CONTEXT_FAILURE'
  | 'BUSINESS_FAILURE'
  | 'LOOP_DETECTED';

export interface DebugIssue {
  type: DebugIssueType;
  severity: DebugSeverity;
  eventId: string;
  eventType: string;
  label: string;
  reason: string;
  detectedBy: 'HEURISTIC_V1';
  timestamp: Date;
}

export interface TimelineDepthInfo {
  depth: number;
  orphaned: boolean;
}

const severityRank: Record<DebugSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
};

const MAX_PREVIEW_LENGTH = 240;

export const isRecord = (value: unknown): value is EventPayload =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const getPayload = (event: EventEntity): EventPayload =>
  isRecord(event.payload) ? event.payload : {};

export const getPayloadString = (
  payload: EventPayload,
  key: string,
): string | undefined => {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
};

export const getPayloadNumber = (
  payload: EventPayload,
  key: string,
): number | undefined => {
  const value = payload[key];
  return typeof value === 'number' ? value : undefined;
};

export const getPayloadBoolean = (
  payload: EventPayload,
  key: string,
): boolean | undefined => {
  const value = payload[key];
  return typeof value === 'boolean' ? value : undefined;
};

export const getPayloadRiskLevel = (
  payload: EventPayload,
  key: string,
): LynxRiskLevel | undefined => {
  const value = payload[key];
  return value === 'LOW' ||
    value === 'MEDIUM' ||
    value === 'HIGH' ||
    value === 'CRITICAL'
    ? value
    : undefined;
};

export const toDebugString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : createPreview(value);

export const maxSeverity = (
  left: DebugSeverity,
  right: DebugSeverity,
): DebugSeverity => (severityRank[left] >= severityRank[right] ? left : right);

export const computeSeverity = (event: EventEntity): DebugSeverity => {
  const payload = getPayload(event);
  const reported =
    normalizeReportedSeverity(payload.severity) ??
    riskToSeverity(payload.riskLevel);

  let computed: DebugSeverity = 'INFO';
  if (
    event.eventType === 'ERROR' ||
    event.eventType === 'POLICY_VIOLATION' ||
    event.eventType === 'GUARDRAIL_ACTIVATED' ||
    payload.error
  ) {
    computed = 'CRITICAL';
  } else if (
    (event.latency ?? getPayloadNumber(payload, 'latency') ?? 0) >= 3000
  ) {
    computed = 'WARNING';
  }

  return reported ? maxSeverity(reported, computed) : computed;
};

export const deriveIssues = (events: EventEntity[]): DebugIssue[] => {
  const issues: DebugIssue[] = [];

  for (const event of events) {
    const payload = getPayload(event);
    const latency = event.latency ?? getPayloadNumber(payload, 'latency');
    const base = {
      eventId: event.id,
      eventType: event.eventType,
      label: event.label,
      detectedBy: 'HEURISTIC_V1' as const,
      timestamp: event.timestamp,
    };

    if (event.eventType === 'ERROR' || payload.error) {
      issues.push({
        ...base,
        type: 'RUNTIME_ERROR',
        severity: 'CRITICAL',
        reason:
          toDebugString(payload.error) ?? 'Runtime error event was recorded.',
      });
    }
    if (
      event.eventType === 'POLICY_VIOLATION' ||
      (event.eventType === 'GUARDRAIL_ACTIVATED' && payload.action !== 'ALLOW')
    ) {
      issues.push({
        ...base,
        type: 'POLICY_BLOCK',
        severity: computeSeverity(event),
        reason:
          toDebugString(payload.reason) ??
          'Policy blocked or activated guardrail.',
      });
    }
    if (
      event.eventType === 'TOOL_RESULT' &&
      (payload.error || payload.status === 'FAILED')
    ) {
      issues.push({
        ...base,
        type: 'TOOL_FAILURE',
        severity: 'CRITICAL',
        reason: toDebugString(payload.error) ?? 'Tool execution failed.',
      });
    }
    if (typeof latency === 'number' && latency >= 3000) {
      issues.push({
        ...base,
        type: 'HIGH_LATENCY',
        severity: latency >= 10000 ? 'CRITICAL' : 'WARNING',
        reason: `Latency exceeded threshold: ${latency}ms.`,
      });
    }
    if (event.eventType === 'MEMORY_ACCESS' && payload.hit === false) {
      issues.push({
        ...base,
        type: 'MEMORY_MISS',
        severity: 'WARNING',
        reason: 'Memory lookup missed.',
      });
    }
    if (event.eventType === 'MEMORY_ACCESS' && payload.stale === true) {
      issues.push({
        ...base,
        type: 'STALE_MEMORY',
        severity: 'WARNING',
        reason: 'Stale memory was used.',
      });
    }
    if (
      event.eventType === 'CONTEXT_RETRIEVAL' &&
      (payload.error || payload.status === 'FAILED')
    ) {
      issues.push({
        ...base,
        type: 'CONTEXT_FAILURE',
        severity: 'WARNING',
        reason: toDebugString(payload.error) ?? 'Context retrieval failed.',
      });
    }
    if (event.eventType === 'SESSION_OUTCOME') {
      const failed =
        payload.status === 'FAILED' || payload.businessStatus === 'FAILED';
      if (failed) {
        issues.push({
          ...base,
          type: 'BUSINESS_FAILURE',
          severity: computeSeverity(event),
          reason:
            toDebugString(payload.reason) ??
            'Session ended with failed outcome.',
        });
      }
    }
    if (event.eventType === 'LOOP_DETECTED' || payload.loopDetected === true) {
      issues.push({
        ...base,
        type: 'LOOP_DETECTED',
        severity: 'CRITICAL',
        reason: 'Repeated event loop was detected.',
      });
    }
  }

  return issues.sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
};

export const createPreview = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;

  const raw =
    typeof value === 'string'
      ? value
      : JSON.stringify(value, (_key: string, nestedValue: unknown): unknown =>
          typeof nestedValue === 'bigint'
            ? nestedValue.toString()
            : nestedValue,
        );
  if (!raw) return undefined;

  const masked = maskSensitiveText(raw);
  return masked.length > MAX_PREVIEW_LENGTH
    ? `${masked.slice(0, MAX_PREVIEW_LENGTH)}...`
    : masked;
};

export const percentile = (
  values: Array<number | null | undefined>,
  ratio: number,
): number | null => {
  const sorted = values
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);

  if (sorted.length === 0) return null;
  const index = Math.ceil(ratio * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

export const average = (values: Array<number | null | undefined>): number => {
  const valid = values.filter(
    (value): value is number => typeof value === 'number',
  );
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

export const createFailureSignature = (input: {
  eventType: string;
  label: string;
  model?: string;
  toolName?: string;
}): string =>
  [
    input.eventType,
    normalizeLabel(input.label) || 'unlabeled',
    input.toolName ?? 'no-tool',
    input.model ?? 'no-model',
  ].join('|');

export const getSpanId = (event: EventEntity): string | undefined =>
  getPayloadString(getPayload(event), 'spanId');

export const getParentSpanId = (event: EventEntity): string | undefined =>
  getPayloadString(getPayload(event), 'parentSpanId');

export const calculateDepth = (
  event: EventEntity,
  eventBySpanId: Map<string, EventEntity>,
  visited = new Set<string>(),
): TimelineDepthInfo => {
  const spanId = getSpanId(event);
  const parentSpanId = getParentSpanId(event);

  if (!spanId || !parentSpanId) return { depth: 0, orphaned: false };
  if (spanId === parentSpanId || visited.has(spanId)) {
    return { depth: 0, orphaned: true };
  }

  const parent = eventBySpanId.get(parentSpanId);
  if (!parent) return { depth: 0, orphaned: true };

  visited.add(spanId);
  const parentDepth = calculateDepth(parent, eventBySpanId, visited);
  return {
    depth: parentDepth.depth + 1,
    orphaned: parentDepth.orphaned,
  };
};

export const calculateCriticalPath = (events: EventEntity[]): string[] => {
  const childrenBySpan = new Map<string, EventEntity[]>();
  const eventsBySpan = new Map<string, EventEntity>();

  for (const event of events) {
    const spanId = getSpanId(event);
    if (spanId && !eventsBySpan.has(spanId)) eventsBySpan.set(spanId, event);
  }

  for (const event of events) {
    const parentSpanId = getParentSpanId(event);
    if (!parentSpanId) continue;
    const children = childrenBySpan.get(parentSpanId) ?? [];
    children.push(event);
    childrenBySpan.set(parentSpanId, children);
  }

  const roots = events.filter((event) => {
    const parentSpanId = getParentSpanId(event);
    return !parentSpanId || !eventsBySpan.has(parentSpanId);
  });

  let best = { score: 0, path: [] as string[] };
  for (const root of roots.length > 0 ? roots : events) {
    const candidate = scorePath(root, childrenBySpan);
    if (candidate.score > best.score) best = candidate;
  }

  return best.path;
};

const scorePath = (
  event: EventEntity,
  childrenBySpan: Map<string, EventEntity[]>,
  visited = new Set<string>(),
): { score: number; path: string[] } => {
  const spanId = getSpanId(event) ?? event.id;
  if (visited.has(spanId)) return { score: 0, path: [event.id] };
  visited.add(spanId);

  const children = childrenBySpan.get(spanId) ?? [];
  let bestChild = { score: 0, path: [] as string[] };
  for (const child of children) {
    const candidate = scorePath(child, childrenBySpan, new Set(visited));
    if (candidate.score > bestChild.score) bestChild = candidate;
  }

  return {
    score: (event.latency ?? 0) + bestChild.score,
    path: [event.id, ...bestChild.path],
  };
};

const riskToSeverity = (riskLevel: unknown): DebugSeverity | undefined => {
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') return 'CRITICAL';
  if (riskLevel === 'MEDIUM') return 'WARNING';
  if (riskLevel === 'LOW') return 'INFO';
  return undefined;
};

const normalizeReportedSeverity = (
  value: unknown,
): DebugSeverity | undefined => {
  if (value === 'CRITICAL' || value === 'WARNING' || value === 'INFO') {
    return value;
  }
  return undefined;
};

const maskSensitiveText = (value: string): string =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[MASKED_EMAIL]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [MASKED_SECRET]')
    .replace(
      /(api[-_]?key|token|password|secret)["']?\s*[:=]\s*["']?[^"',\s}]+/gi,
      '$1:[MASKED_SECRET]',
    );

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
