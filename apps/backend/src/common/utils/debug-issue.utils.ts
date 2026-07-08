import type { EventEntity } from '@repo/database';
import type { DebugIssue } from '../types/debug-event.types';
import { getPayload, getPayloadNumber } from './event-payload.utils';
import { toDebugString } from './debug-preview.utils';
import { computeSeverity } from './debug-severity.utils';

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
