import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { LynxEventType, LynxRiskLevel, TokenUsage } from "@repo/sdk-types";

export const DEBUG_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export const DEBUG_SESSION_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const DEBUG_EVENT_PHASES = ["start", "end", "error", "single"] as const;
export const DEBUG_REPRODUCE_MODES = ["DRY_RUN", "REPLAY", "SIMULATE"] as const;

export type DebugSeverity = (typeof DEBUG_SEVERITIES)[number];
export type DebugSessionStatus = (typeof DEBUG_SESSION_STATUSES)[number];
export type DebugEventPhase = (typeof DEBUG_EVENT_PHASES)[number];
export type DebugReproduceMode = (typeof DEBUG_REPRODUCE_MODES)[number];
export type DebugTrendDirection = "up" | "down" | "flat";
export type DebugRiskCategory =
  | "read-only"
  | "write"
  | "external"
  | "destructive";

/**
 * 디버깅 API에서 공통으로 사용하는 워크스페이스 쿼리 DTO입니다.
 */
export class DebugWorkspaceQueryDto {
  @IsNotEmpty()
  @IsUUID()
  workspaceId!: string;
}

/**
 * 세션, 로그, 분석 화면에서 공통으로 사용하는 시간 범위 및 페이지네이션 DTO입니다.
 */
export class DebugSearchQueryDto extends DebugWorkspaceQueryDto {
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

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
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

/**
 * 세션 목록과 이상 세션 목록을 조회할 때 사용하는 요청 DTO입니다.
 */
export class DebugSessionListQueryDto extends DebugSearchQueryDto {
  @IsOptional()
  @IsIn(DEBUG_SESSION_STATUSES)
  status?: DebugSessionStatus;

  @IsOptional()
  @IsIn(DEBUG_SEVERITIES)
  severity?: DebugSeverity;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  anomalyOnly?: boolean;
}

/**
 * 특정 세션의 실행 타임라인과 원본 payload를 조회할 때 사용하는 요청 DTO입니다.
 */
export class DebugTimelineQueryDto extends DebugWorkspaceQueryDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePayload?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeRawIo?: boolean;
}

/**
 * 로그, LLM I/O, 툴 호출 디버깅 화면의 이벤트 목록 요청 DTO입니다.
 */
export class DebugEventLogQueryDto extends DebugSearchQueryDto {
  @IsOptional()
  @IsString()
  eventType?: LynxEventType;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsIn(DEBUG_EVENT_PHASES)
  phase?: DebugEventPhase;

  @IsOptional()
  @IsIn(DEBUG_SEVERITIES)
  severity?: DebugSeverity;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  errorsOnly?: boolean;
}

/**
 * 원인 분석(RCA)을 요청할 때 사용하는 DTO입니다.
 */
export class DebugRootCauseQueryDto extends DebugWorkspaceQueryDto {
  @IsOptional()
  @IsString()
  issueId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  depth?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSuggestions?: boolean;
}

/**
 * 장애 패턴, 병목, 지연시간, 메모리 분석 화면에서 사용하는 요청 DTO입니다.
 */
export class DebugAnalysisQueryDto extends DebugSearchQueryDto {
  @IsOptional()
  @IsString()
  groupBy?: "agent" | "model" | "tool" | "eventType" | "hour" | "day";

  @IsOptional()
  @IsIn(DEBUG_SEVERITIES)
  minSeverity?: DebugSeverity;
}

export class DebugReplayOverrideDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsObject()
  modelConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  promptVersion?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  toolResults?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  policy?: Record<string, unknown>;
}

/**
 * 세션 재현 또는 시뮬레이션을 요청할 때 사용하는 body DTO입니다.
 */
export class DebugReproduceRequestDto {
  @IsNotEmpty()
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsIn(DEBUG_REPRODUCE_MODES)
  mode?: DebugReproduceMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => DebugReplayOverrideDto)
  overrides?: DebugReplayOverrideDto;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  persistResult?: boolean;
}

export class DebugPolicySimulationRequestDto {
  @IsNotEmpty()
  @IsUUID()
  workspaceId!: string;

  @IsNotEmpty()
  @IsString()
  sessionId!: string;

  @IsNotEmpty()
  @IsString()
  toolName!: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  policyIds?: string[];
}

export interface DebugPageInfoDto {
  nextCursor?: string;
  total?: number;
  hasMore: boolean;
}

export interface DebugSessionSummaryDto {
  id: string;
  runId: string;
  agentId: string;
  agentName: string;
  userId?: string;
  status: DebugSessionStatus;
  severity: DebugSeverity;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  issueCount: number;
  primaryIssue?: string;
  totalTokens: number;
  totalCost: number;
}

export interface DebugSessionListResponseDto {
  sessions: DebugSessionSummaryDto[];
  page: DebugPageInfoDto;
}

export interface DebugTimelineNodeDto {
  id: string;
  eventId: string;
  eventType: LynxEventType;
  label: string;
  phase: DebugEventPhase;
  timestamp: string;
  spanId?: string;
  parentSpanId?: string;
  depth: number;
  latency?: number;
  cost?: number;
  usage?: TokenUsage;
  severity?: DebugSeverity;
  riskLevel?: LynxRiskLevel;
  model?: string;
  provider?: string;
  toolName?: string;
  summary?: string;
  inputPreview?: string;
  outputPreview?: string;
  error?: string;
  orphaned?: boolean;
  payload?: Record<string, unknown>;
}

export interface DebugTimelineResponseDto {
  session: DebugSessionSummaryDto;
  nodes: DebugTimelineNodeDto[];
  criticalPath: string[];
  criticalPathMethod?: "MAX_ACCUMULATED_LATENCY";
  highlightedEventId?: string;
}

export interface DebugEventLogItemDto {
  id: string;
  sessionId: string;
  runId: string;
  agentName: string;
  eventType: LynxEventType;
  label: string;
  phase: DebugEventPhase;
  timestamp: string;
  latency?: number;
  cost?: number;
  model?: string;
  toolName?: string;
  severity?: DebugSeverity;
  error?: string;
  inputPreview?: string;
  outputPreview?: string;
  payload?: Record<string, unknown>;
}

export interface DebugEventLogResponseDto {
  events: DebugEventLogItemDto[];
  page: DebugPageInfoDto;
}

export interface DebugToolCallItemDto extends DebugEventLogItemDto {
  toolName: string;
  status: "success" | "failed" | "timeout" | "unknown";
  retryCount: number;
  sideEffect: boolean;
  riskCategory: DebugRiskCategory;
  argumentsPreview?: string;
  resultPreview?: string;
}

export interface DebugToolCallListResponseDto {
  toolCalls: DebugToolCallItemDto[];
  page: DebugPageInfoDto;
}

export interface DebugLlmCallItemDto extends DebugEventLogItemDto {
  provider?: string;
  model: string;
  promptVersion?: string;
  temperature?: number;
  maxTokens?: number;
  finishReason?: string;
  totalTokens: number;
  requestedToolCall?: boolean;
  refused?: boolean;
  requestPreview?: string;
  responsePreview?: string;
}

export interface DebugLlmCallListResponseDto {
  llmCalls: DebugLlmCallItemDto[];
  page: DebugPageInfoDto;
}

export interface DebugErrorGroupDto {
  fingerprint: string;
  title: string;
  errorType: string;
  severity: DebugSeverity;
  occurrenceCount: number;
  affectedSessions: number;
  affectedAgents: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  representativeEventId: string;
  representativeSessionId: string;
  representativeMessage?: string;
  relatedTool?: string;
  relatedModel?: string;
  status: "open" | "investigating" | "resolved";
}

export interface DebugErrorGroupListResponseDto {
  errors: DebugErrorGroupDto[];
  page: DebugPageInfoDto;
}

export interface DebugEvidenceDto {
  eventId: string;
  eventType: LynxEventType;
  label: string;
  timestamp: string;
  summary: string;
  weight: number;
}

export interface DebugRootCauseCandidateDto {
  id: string;
  title: string;
  category:
    | "PROMPT"
    | "MODEL"
    | "CONTEXT"
    | "MEMORY"
    | "TOOL"
    | "POLICY"
    | "RUNTIME"
    | "UNKNOWN";
  confidence: number;
  severity: DebugSeverity;
  explanation: string;
  firstBadEventId?: string;
  evidence: DebugEvidenceDto[];
}

export interface DebugRootCauseResponseDto {
  issueId?: string;
  sessionId: string;
  summary: string;
  candidates: DebugRootCauseCandidateDto[];
  primaryCandidateId?: string;
  confidence?: number;
  analysisMethod?: "HEURISTIC_V1";
  recommendedActions: Array<{
    title: string;
    description: string;
    target: "PROMPT" | "POLICY" | "TOOL" | "MODEL" | "CODE" | "DATA";
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

export interface DebugFailurePatternDto {
  id: string;
  name: string;
  severity: DebugSeverity;
  occurrenceCount: number;
  affectedAgents: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  signature: {
    eventTypes: LynxEventType[];
    labels: string[];
    model?: string;
    toolName?: string;
  };
  signatureVersion?: "SIGNATURE_V1";
  exampleSessionId: string;
}

export interface DebugFailurePatternResponseDto {
  patterns: DebugFailurePatternDto[];
}

export interface DebugReproduceStepDto {
  sourceEventId: string;
  eventType: LynxEventType;
  label: string;
  status: "MATCHED" | "CHANGED" | "FAILED" | "SKIPPED";
  order?: number;
  replayable?: boolean;
  reason?: string;
  expectedPreview?: string;
  actualPreview?: string;
  diffSummary?: string;
}

export interface DebugReproducePackageDto {
  userInput?: string;
  promptVersion?: string;
  agentVersion?: string;
  policyVersion?: string;
  sdkVersion?: string;
  environment?: string;
  modelSettings: Array<{
    eventId: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    requestPreview?: string;
  }>;
  toolCalls: Array<{
    eventId: string;
    toolName: string;
    argumentsPreview?: string;
    sideEffect: boolean;
    riskCategory: DebugRiskCategory;
  }>;
  contextSnapshots: Array<{
    eventId: string;
    label: string;
    preview?: string;
  }>;
  auditTrail: Array<{
    label: string;
    value: string;
  }>;
}

export interface DebugReproduceResponseDto {
  replayId: string;
  sourceSessionId: string;
  mode: DebugReproduceMode;
  status:
    | "READY"
    | "DRY_RUN_ONLY"
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED";
  reproducible?: boolean;
  limitations?: string[];
  deterministicScore?: number;
  startedAt?: string;
  completedAt?: string;
  steps: DebugReproduceStepDto[];
  replayPackage?: DebugReproducePackageDto;
  summary?: string;
}

export interface DebugBottleneckItemDto {
  id: string;
  type: "LLM" | "TOOL" | "MEMORY" | "CONTEXT" | "POLICY" | "RUNTIME";
  label: string;
  count: number;
  avgLatency: number;
  p95Latency: number;
  totalCost: number;
  affectedSessions: number;
  trend: DebugTrendDirection;
}

export interface DebugBottleneckResponseDto {
  bottlenecks: DebugBottleneckItemDto[];
}

export interface DebugLatencyBucketDto {
  bucket: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface DebugLatencyResponseDto {
  summary: {
    avgLatency: number;
    p50: number;
    p95: number;
    p99: number | null;
    slowEventCount: number;
  };
  buckets: DebugLatencyBucketDto[];
}

export interface DebugMemoryAccessDto {
  eventId: string;
  sessionId: string;
  operation: string;
  key?: string;
  hit?: boolean;
  stale?: boolean;
  timestamp: string;
  summary?: string;
}

export interface DebugMemoryResponseDto {
  accesses: DebugMemoryAccessDto[];
  hitCount?: number;
  missCount?: number;
  staleMemoryCount: number;
  memoryMissCount: number;
  unknownCount?: number;
}

export interface DebugPolicySimulationResponseDto {
  allow: boolean;
  toolName: string;
  result?: "ALLOW" | "WARN" | "BLOCK";
  source?: "RECORDED_POLICY_EVENT" | "POLICY_ENGINE" | "NO_MATCH";
  actuallyEvaluated?: boolean;
  matchedPolicies: Array<{
    policyId: string;
    name?: string;
    version?: string;
    result: "ALLOW" | "WARN" | "BLOCK";
    reason?: string;
    severity?: LynxRiskLevel;
  }>;
}
