import type { DebugSeverity } from '@repo/dto';

export type LynxRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
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
