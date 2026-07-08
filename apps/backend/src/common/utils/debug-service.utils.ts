import { BadRequestException } from '@nestjs/common';
import { EventEntity, SessionEntity } from '@repo/database';
import {
  DebugBottleneckResponseDto,
  DebugEventLogItemDto,
  DebugEventLogResponseDto,
  DebugLlmCallListResponseDto,
  DebugPageInfoDto,
  DebugRiskCategory,
  DebugRootCauseResponseDto,
  DebugSearchQueryDto,
  DebugSessionSummaryDto,
  DebugSeverity,
  DebugTimelineNodeDto,
  DebugToolCallListResponseDto,
} from '@repo/dto';
import { MAX_DEBUG_RANGE_DAYS } from '../constants/debug.constants';
import { DebugCursorValue } from '../types/debug.types';
import { calculateDepth } from './timeline.utils';
import { computeSeverity, maxSeverity } from './debug-severity.utils';
import { createPreview, toDebugString } from './debug-preview.utils';
import { deriveIssues } from './debug-issue.utils';
import { EventPayload } from '../types/debug-event.types';
import {
  getPayload,
  getPayloadBoolean,
  getPayloadNumber,
  getPayloadRiskLevel,
  getPayloadString,
  isRecord,
} from './event-payload.utils';
import { percentile } from './statistics.utils';

export function decodeDebugCursor(
  cursor?: string,
): DebugCursorValue | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as DebugCursorValue;
    if (!parsed.timestamp || !parsed.id) {
      throw new Error('Missing cursor fields.');
    }
    return parsed;
  } catch {
    throw new BadRequestException({
      message: 'Invalid pagination cursor.',
    });
  }
}

export function encodeDebugCursor(timestamp: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ timestamp: timestamp.toISOString(), id }),
    'utf8',
  ).toString('base64url');
}

export function normalizeDebugLimit(limit?: number, fallback = 50): number {
  return Math.min(Math.max(limit ?? fallback, 1), 500);
}

export function getDebugDateRange(
  query: DebugSearchQueryDto,
  fallbackHours = 24,
) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - fallbackHours * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException({ message: 'Invalid date range.' });
  }
  if (from > to) {
    throw new BadRequestException({
      message: '`from` must be earlier than `to`.',
    });
  }

  const maxMs = MAX_DEBUG_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    throw new BadRequestException({
      message: `Debug queries can cover at most ${MAX_DEBUG_RANGE_DAYS} days.`,
    });
  }

  return { from, to };
}

export function createDebugPageInfo<T>(
  items: T[],
  limit: number,
  getCursor: (item: T) => string,
): DebugPageInfoDto {
  const hasMore = items.length > limit;
  const lastVisible = items.slice(0, limit).at(-1);
  return {
    hasMore,
    nextCursor: hasMore && lastVisible ? getCursor(lastVisible) : undefined,
  };
}

export function toDebugSessionSummary(
  session: SessionEntity,
): DebugSessionSummaryDto {
  const events = [...(session.events ?? [])].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
  const issues = deriveIssues(events);
  const severity = issues.reduce<DebugSeverity>(
    (current, issue) => maxSeverity(current, issue.severity),
    'INFO',
  );

  return {
    id: session.id,
    runId: getDebugSessionRunId(session, events),
    agentId: session.agent?.id ?? '',
    agentName: session.agent?.name ?? 'Unknown Agent',
    status: session.status as DebugSessionSummaryDto['status'],
    severity,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString(),
    durationMs: session.endedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : undefined,
    issueCount: issues.length,
    primaryIssue: issues[0]?.type,
    totalTokens: session.totalTokens ?? 0,
    totalCost: Number(session.totalCost ?? 0),
  };
}

export function toDebugEventLogItem(event: EventEntity): DebugEventLogItemDto {
  const payload = getPayload(event);
  const session = event.session;

  return {
    id: event.id,
    sessionId: session?.id ?? '',
    runId: getDebugEventRunId(event),
    agentName: session?.agent?.name ?? 'Unknown Agent',
    eventType: event.eventType as DebugEventLogItemDto['eventType'],
    label: event.label,
    phase: getDebugEventPhase(event),
    timestamp: event.timestamp.toISOString(),
    latency: event.latency ?? getPayloadNumber(payload, 'latency'),
    cost: Number(event.cost ?? payload.cost ?? 0),
    model: getPayloadString(payload, 'model'),
    toolName: getPayloadString(payload, 'toolName'),
    severity: computeSeverity(event),
    error: toDebugString(payload.error),
    inputPreview: createPreview(payload.input ?? payload.args),
    outputPreview: createPreview(payload.output ?? payload.result),
    payload,
  };
}

export function toDebugToolCallItem(
  event: EventEntity,
): DebugToolCallListResponseDto['toolCalls'][number] {
  const payload = getPayload(event);
  const base = toDebugEventLogItem(event);
  const rawStatus = getPayloadString(payload, 'status')?.toLowerCase();
  const hasTimeout =
    rawStatus === 'timeout' ||
    toDebugString(payload.error)?.toLowerCase().includes('timeout') === true;
  const hasFailed =
    hasTimeout || rawStatus === 'failed' || Boolean(payload.error);

  return {
    ...base,
    toolName:
      base.toolName ??
      getPayloadString(payload, 'name') ??
      getPayloadString(payload, 'tool') ??
      base.label,
    status: hasTimeout
      ? 'timeout'
      : hasFailed
        ? 'failed'
        : rawStatus === 'success'
          ? 'success'
          : 'unknown',
    retryCount: getPayloadNumber(payload, 'retryCount') ?? 0,
    sideEffect: getPayloadBoolean(payload, 'sideEffect') ?? false,
    riskCategory: toDebugRiskCategory(payload),
    argumentsPreview: createPreview(payload.args ?? payload.arguments),
    resultPreview: createPreview(payload.result ?? payload.output),
  };
}

export function toDebugLlmCallItem(
  event: EventEntity,
): DebugLlmCallListResponseDto['llmCalls'][number] {
  const payload = getPayload(event);
  const base = toDebugEventLogItem(event);
  const usage = toDebugTokenUsage(payload.usage);

  return {
    ...base,
    provider: getPayloadString(payload, 'provider'),
    model: base.model ?? 'unknown',
    promptVersion: getPayloadString(payload, 'promptVersion'),
    temperature: getPayloadNumber(payload, 'temperature'),
    maxTokens: getPayloadNumber(payload, 'maxTokens'),
    finishReason: getPayloadString(payload, 'finishReason'),
    totalTokens:
      usage?.totalTokens ??
      usage?.promptTokens ??
      usage?.completionTokens ??
      getPayloadNumber(payload, 'totalTokens') ??
      0,
    requestedToolCall:
      getPayloadBoolean(payload, 'requestedToolCall') ??
      Array.isArray(payload.toolCalls),
    refused: getPayloadBoolean(payload, 'refused') ?? false,
    requestPreview: createPreview(payload.messages ?? payload.input),
    responsePreview: createPreview(payload.response ?? payload.output),
  };
}

export function getDebugEventPhase(
  event: EventEntity,
): DebugEventLogItemDto['phase'] {
  const payload = getPayload(event);
  const phase = getPayloadString(payload, 'phase');
  if (
    phase === 'start' ||
    phase === 'end' ||
    phase === 'error' ||
    phase === 'single'
  ) {
    return phase;
  }
  if (event.eventType === 'ERROR' || payload.error) return 'error';
  return 'single';
}

export function getDebugSessionRunId(
  session: SessionEntity,
  events: EventEntity[],
) {
  const payload = getPayload(events[0]);
  return (
    getPayloadString(payload, 'runId') ??
    getPayloadString(payload, 'traceId') ??
    session.name
  );
}

export function getDebugEventRunId(event: EventEntity) {
  const payload = getPayload(event);
  return (
    getPayloadString(payload, 'runId') ??
    getPayloadString(payload, 'traceId') ??
    event.session?.name ??
    ''
  );
}

export function toDebugTimelineNode(
  event: EventEntity,
  eventBySpanId: Map<string, EventEntity>,
  includePayload = false,
): DebugTimelineNodeDto {
  const payload = getPayload(event);
  const depth = calculateDepth(event, eventBySpanId);

  return {
    id: event.id,
    eventId: event.id,
    eventType: event.eventType as DebugTimelineNodeDto['eventType'],
    label: event.label,
    phase: getDebugEventPhase(event),
    timestamp: event.timestamp.toISOString(),
    spanId: getPayloadString(payload, 'spanId'),
    parentSpanId: getPayloadString(payload, 'parentSpanId'),
    depth: depth.depth,
    latency: event.latency ?? getPayloadNumber(payload, 'latency'),
    cost: Number(event.cost ?? payload.cost ?? 0),
    usage: toDebugTokenUsage(payload.usage),
    severity: computeSeverity(event),
    riskLevel: getPayloadRiskLevel(payload, 'riskLevel'),
    model: getPayloadString(payload, 'model'),
    provider: getPayloadString(payload, 'provider'),
    toolName: getPayloadString(payload, 'toolName'),
    summary:
      toDebugString(payload.reason) ??
      toDebugString(payload.message) ??
      event.label,
    inputPreview: createPreview(payload.input ?? payload.args),
    outputPreview: createPreview(payload.output ?? payload.result),
    error: toDebugString(payload.error),
    orphaned: depth.orphaned,
    payload: includePayload ? payload : undefined,
  };
}

export function canExposeRawDebugPayloads() {
  return process.env.LYNX_EXPOSE_RAW_PAYLOADS === 'true';
}

export function toDebugRootCauseCategory(
  issueType: string,
): DebugRootCauseResponseDto['candidates'][number]['category'] {
  if (issueType.startsWith('POLICY')) return 'POLICY';
  if (issueType.startsWith('TOOL')) return 'TOOL';
  if (issueType.includes('MEMORY')) return 'MEMORY';
  if (issueType.includes('CONTEXT')) return 'CONTEXT';
  if (issueType.includes('BUSINESS')) return 'UNKNOWN';
  if (issueType.includes('LOOP')) return 'RUNTIME';
  return 'RUNTIME';
}

export function toDebugBottleneckType(
  event: EventEntity,
): DebugBottleneckResponseDto['bottlenecks'][number]['type'] {
  if (event.eventType.includes('LLM')) return 'LLM';
  if (event.eventType.includes('TOOL')) return 'TOOL';
  if (event.eventType.includes('MEMORY')) return 'MEMORY';
  if (event.eventType.includes('CONTEXT')) return 'CONTEXT';
  if (event.eventType.includes('POLICY')) return 'POLICY';
  return 'RUNTIME';
}

export function toDebugLatencyBuckets(events: EventEntity[]) {
  const groups = new Map<string, number[]>();
  for (const event of events) {
    const bucket = event.timestamp.toISOString().slice(0, 13) + ':00:00.000Z';
    const latency =
      event.latency ?? getPayloadNumber(getPayload(event), 'latency');
    if (typeof latency !== 'number') continue;
    groups.set(bucket, [...(groups.get(bucket) ?? []), latency]);
  }

  return Array.from(groups.entries()).map(([bucket, values]) => ({
    bucket,
    count: values.length,
    p50: percentile(values, 0.5) ?? 0,
    p95: percentile(values, 0.95) ?? 0,
    p99: percentile(values, 0.99) ?? 0,
  }));
}

export function toDebugTokenUsage(
  value: unknown,
): DebugTimelineNodeDto['usage'] {
  if (!isRecord(value)) return undefined;
  return value as unknown as DebugTimelineNodeDto['usage'];
}

export function isDebugReplayable(
  eventType: string,
  payload: EventPayload,
): boolean {
  if (eventType === 'USER_INPUT') return true;
  if (eventType === 'CONTEXT_RETRIEVAL') return true;
  if (eventType === 'MEMORY_ACCESS') return true;
  if (eventType.includes('LLM')) return true;
  if (eventType.includes('TOOL')) return payload.sideEffect !== true;
  return false;
}

export function normalizeDebugPolicyResult(
  action: unknown,
  allow: unknown,
): 'ALLOW' | 'WARN' | 'BLOCK' {
  if (action === 'BLOCK' || action === 'REQUIRE_APPROVAL') return 'BLOCK';
  if (action === 'WARN') return 'WARN';
  if (allow === false) return 'BLOCK';
  return 'ALLOW';
}

export function toDebugRiskCategory(payload: EventPayload): DebugRiskCategory {
  const explicit = getPayloadString(payload, 'riskCategory');
  if (
    explicit === 'read-only' ||
    explicit === 'write' ||
    explicit === 'external' ||
    explicit === 'destructive'
  ) {
    return explicit;
  }
  if (payload.destructive === true) return 'destructive';
  if (payload.sideEffect === true) return 'write';
  if (payload.external === true) return 'external';
  return 'read-only';
}

export function getDebugSeverityRank(severity: DebugSeverity): number {
  if (severity === 'CRITICAL') return 2;
  if (severity === 'WARNING') return 1;
  return 0;
}

export function findFirstPayloadString(events: EventEntity[], key: string) {
  for (const event of events) {
    const value = getPayloadString(getPayload(event), key);
    if (value) return value;
  }
  return undefined;
}
