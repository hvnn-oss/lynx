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

export const AGENT_PAGE_KINDS = [
  "overview",
  "active",
  "inactive",
  "groups",
  "intent",
  "tools",
  "saas",
  "history",
  "latency",
  "tokens",
  "success-rate",
  "cost",
] as const;

export const AGENT_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "WARNING",
  "CRITICAL",
] as const;

export type AgentPageKind = (typeof AGENT_PAGE_KINDS)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AgentTone = "neutral" | "good" | "warning" | "bad";

export class AgentListQueryDto {
  @IsUUID()
  workspaceId!: string;

  @IsOptional()
  @IsIn(AGENT_PAGE_KINDS)
  kind?: AgentPageKind;

  @IsOptional()
  @IsIn(AGENT_STATUSES)
  status?: AgentStatus;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  agent?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  tool?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

export class AgentDetailQueryDto {
  @IsUUID()
  workspaceId!: string;
}

export interface AgentPageInfoDto {
  nextCursor?: string;
  total?: number;
  hasMore: boolean;
}

export interface AgentIssueBadgeDto {
  label: string;
  type: string;
  tone: AgentTone;
  reason?: string;
}

export interface AgentMetricPointDto {
  timestamp: string;
  value: number;
  successCount?: number;
  failedCount?: number;
  cost?: number;
  tokens?: number;
  latencyMs?: number;
}

export interface AgentRelatedLinkDto {
  label: string;
  href: string;
  kind: "sessions" | "debug" | "tools" | "cost" | "performance";
}

export interface AgentListItemDto {
  agentId: string;
  name: string;
  description?: string;
  role?: string;
  owner?: string;
  team?: string;
  group?: string;
  status: AgentStatus;
  environment?: string;
  version?: string;
  defaultModel?: string;
  lastActiveAt?: string;
  lastRunAt?: string;
  sessionCount24h: number;
  totalSessions: number;
  successRate: number | null;
  failureRate: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  totalCost: number;
  totalTokens: number;
  avgCostPerRun: number | null;
  tokensPerSuccessfulRun: number | null;
  llmCallCount: number;
  toolCallCount: number;
  guardrailCount: number;
  errorCount: number;
  retryCount: number;
  connectedToolCount: number;
  models: string[];
  tools: string[];
  saasApps: string[];
  issueBadges: AgentIssueBadgeDto[];
  primaryIssue?: string;
  recommendation?: string;
  relatedLinks: AgentRelatedLinkDto[];
  trend: AgentMetricPointDto[];
}

export interface AgentOverviewResponseDto {
  totalAgents: number;
  activeAgents: number;
  inactiveAgents: number;
  warningAgents: number;
  criticalAgents: number;
  sessions24h: number;
  avgSuccessRate: number | null;
  avgLatencyMs: number | null;
  totalCost: number;
  totalTokens: number;
  topIssue?: string;
  topAgent?: string;
  recommendation?: string;
}

export interface AgentListResponseDto {
  overview: AgentOverviewResponseDto;
  agents: AgentListItemDto[];
  page: AgentPageInfoDto;
}

export interface AgentGroupItemDto {
  groupId: string;
  name: string;
  agentCount: number;
  activeAgents: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  totalCost: number;
  topIssue?: string;
}

export interface AgentToolUsageItemDto {
  toolName: string;
  agentCount: number;
  callCount: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  timeoutCount: number;
  sideEffect: "read-only" | "write" | "external" | "destructive" | "unknown";
  relatedAgents: string[];
}

export interface AgentSaasAccessItemDto {
  appName: string;
  agentCount: number;
  callCount: number;
  writeCount: number;
  failureCount: number;
  riskLevel: "low" | "medium" | "high";
  relatedAgents: string[];
}

export interface AgentBehaviorEventDto {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  eventType: string;
  summary: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  sessionId?: string;
  traceId?: string;
}

export interface AgentDetailResponseDto extends AgentListItemDto {
  recentSessions: Array<{
    sessionId: string;
    runId: string;
    status: string;
    startedAt: string;
    durationMs?: number;
    totalCost: number;
    totalTokens: number;
    primaryIssue?: string;
  }>;
  toolUsage: AgentToolUsageItemDto[];
  saasAccess: AgentSaasAccessItemDto[];
  behaviorHistory: AgentBehaviorEventDto[];
  performance: {
    latencyTrend: AgentMetricPointDto[];
    successTrend: AgentMetricPointDto[];
    costTrend: AgentMetricPointDto[];
    tokenTrend: AgentMetricPointDto[];
  };
  recommendations: Array<{
    title: string;
    description: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    href?: string;
  }>;
}

