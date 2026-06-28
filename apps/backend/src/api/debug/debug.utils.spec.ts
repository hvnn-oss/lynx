import { EventEntity } from '@repo/database';
import {
  calculateDepth,
  createPreview,
  deriveIssues,
  percentile,
} from './debug.utils';

const createEvent = (
  id: string,
  payload: Record<string, any> = {},
): EventEntity =>
  ({
    id,
    eventType: payload.eventType ?? 'CONTEXT_ALERT',
    label: payload.label ?? id,
    payload,
    latency: payload.latency,
    cost: 0,
    timestamp: new Date('2026-06-28T00:00:00Z'),
    createdAt: new Date('2026-06-28T00:00:00Z'),
  }) as EventEntity;

describe('debug utils', () => {
  it('calculates percentile with nearest-rank and empty input handling', () => {
    expect(percentile([], 0.95)).toBeNull();
    expect(percentile([100, 20, 50], 0.5)).toBe(50);
    expect(percentile([100, 20, 50], 0.95)).toBe(100);
  });

  it('masks sensitive values in previews', () => {
    const preview = createPreview({
      email: 'user@example.com',
      token: 'secret-token',
    });

    expect(preview).toContain('[MASKED_EMAIL]');
    expect(preview).toContain('[MASKED_SECRET]');
  });

  it('derives deterministic issues from events', () => {
    const issues = deriveIssues([
      createEvent('evt-1', {
        eventType: 'ERROR',
        error: 'boom',
      }),
      createEvent('evt-2', {
        eventType: 'MEMORY_ACCESS',
        hit: false,
      }),
    ]);

    expect(issues.map((issue) => issue.type)).toEqual([
      'RUNTIME_ERROR',
      'MEMORY_MISS',
    ]);
  });

  it('does not recurse forever when spans form a cycle', () => {
    const parent = createEvent('evt-parent', {
      spanId: 'span-a',
      parentSpanId: 'span-b',
    });
    const child = createEvent('evt-child', {
      spanId: 'span-b',
      parentSpanId: 'span-a',
    });
    const eventBySpanId = new Map([
      ['span-a', parent],
      ['span-b', child],
    ]);

    const depth = calculateDepth(parent, eventBySpanId);
    expect(depth.orphaned).toBe(true);
    expect(depth.depth).toBeGreaterThanOrEqual(0);
  });

  it('marks missing parent spans as orphaned', () => {
    const event = createEvent('evt-child', {
      spanId: 'span-b',
      parentSpanId: 'missing-parent',
    });

    const depth = calculateDepth(event, new Map());
    expect(depth).toEqual({ depth: 0, orphaned: true });
  });
});
