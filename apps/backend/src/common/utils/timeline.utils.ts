import type { EventEntity } from '@repo/database';
import type { TimelineDepthInfo } from '../types/debug-event.types';
import { getPayload, getPayloadString } from './event-payload.utils';

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
