import type { EventEntity } from '@repo/database';
import type { DebugSeverity } from '@repo/dto';
import { getPayload, getPayloadNumber } from './event-payload.utils';

const severityRank: Record<DebugSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  CRITICAL: 2,
};

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
