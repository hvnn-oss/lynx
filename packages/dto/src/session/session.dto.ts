import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export const SESSION_PAGE_KINDS = [
  "overview",
  "live",
  "completed",
  "failed",
  "anomaly",
] as const;

export const SESSION_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const SESSION_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;

export const SESSION_FLOW_NODE_TYPES = [
  "user_input",
  "prompt_build",
  "context_load",
  "memory_read",
  "llm_call",
  "tool_call",
  "guardrail_check",
  "retry",
  "error",
  "memory_write",
  "final_response",
] as const;

export const SESSION_FLOW_NODE_STATUSES = [
  "success",
  "warning",
  "error",
  "running",
  "blocked",
  "skipped",
] as const;

export type SessionPageKind = (typeof SESSION_PAGE_KINDS)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type SessionSeverity = (typeof SESSION_SEVERITIES)[number];
export type SessionFlowNodeType = (typeof SESSION_FLOW_NODE_TYPES)[number];
export type SessionFlowNodeStatus = (typeof SESSION_FLOW_NODE_STATUSES)[number];
export type SessionFlowEdgeStatus = "normal" | "retry" | "error" | "blocked";
export type SessionIssueTone = "neutral" | "good" | "warning" | "bad";

export class SessionListQueryDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsIn(SESSION_PAGE_KINDS)
  kind?: SessionPageKind;

  @IsOptional()
  @IsIn(SESSION_STATUSES)
  status?: SessionStatus;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  agent?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  traceId?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SessionDetailQueryDto {
  @IsUUID()
  workspaceId!: string;
}

export interface SessionPageInfoDto {
  nextCursor?: string;
  total?: number;
  hasMore: boolean;
}

export interface SessionIssueBadgeDto {
  label: string;
  type: string;
  tone: SessionIssueTone;
  reason?: string;
}

export interface SessionRelatedDebugLinkDto {
  label: string;
  href: string;
  kind:
    | "trace"
    | "logs"
    | "tool-calls"
    | "llm-io"
    | "errors"
    | "root-cause"
    | "reproduce"
    | "bottleneck"
    | "latency"
    | "memory";
}

export interface SessionListItemDto {
  sessionId: string;
  runId: string;
  traceId?: string;
  agentId: string;
  agentName: string;
  status: SessionStatus;
  severity: SessionSeverity;
  environment?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  llmCallCount: number;
  toolCallCount: number;
  retryCount: number;
  errorCount: number;
  guardrailCount: number;
  totalTokens: number;
  totalCost: number;
  primaryIssue?: string;
  rootCauseCandidate?: string;
  issueBadges: SessionIssueBadgeDto[];
  relatedDebugLinks: SessionRelatedDebugLinkDto[];
}

export interface SessionOverviewResponseDto {
  totalSessions: number;
  runningSessions: number;
  completedSessions: number;
  failedSessions: number;
  anomalySessions: number;
  successRate: number | null;
  avgDurationMs: number | null;
  totalCost: number;
  totalTokens: number;
  topIssue?: string;
  topAgent?: string;
}

export interface SessionListResponseDto {
  overview: SessionOverviewResponseDto;
  sessions: SessionListItemDto[];
  page: SessionPageInfoDto;
}

export interface SessionDetailResponseDto extends SessionListItemDto {
  finalOutputPreview?: string;
  inputPreview?: string;
  modelNames: string[];
  toolNames: string[];
  promptVersion?: string;
  sdkVersion?: string;
  recommendedActions: Array<{
    label: string;
    href: string;
    description: string;
  }>;
}

export interface SessionFlowNodeDto {
  id: string;
  eventId?: string;
  type: SessionFlowNodeType;
  label: string;
  status: SessionFlowNodeStatus;
  timestamp: string;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  model?: string;
  provider?: string;
  toolName?: string;
  parentId?: string;
  issueBadges: SessionIssueBadgeDto[];
  preview?: string;
  detail: Record<string, unknown>;
}

export interface SessionFlowEdgeDto {
  id: string;
  source: string;
  target: string;
  label?: string;
  status: SessionFlowEdgeStatus;
}

export interface SessionTimelineResponseDto {
  session: SessionDetailResponseDto;
  nodes: SessionFlowNodeDto[];
  edges: SessionFlowEdgeDto[];
  criticalNodeIds: string[];
  failedNodeId?: string;
}
