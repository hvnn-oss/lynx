import { IsNotEmpty, IsString } from "class-validator";

/**
 * 대시보드 조회를 위한 기본 쿼리 파라미터 DTO입니다.
 * 클라이언트 및 백엔드 간에 공유됩니다.
 */
export class DashboardQueryDto {
  @IsNotEmpty()
  @IsString()
  workspaceId!: string;
}

/**
 * 1. 대시보드 홈(요약) API 응답 타입 정의
 */
export interface DashboardHomeMetricsDto {
  kpis: {
    agentRuns: { value: number; change: number; trend: "up" | "down" };
    successRate: { value: number; change: number; trend: "up" | "down" };
    avgLatency: { value: number; change: number; trend: "up" | "down" };
    cost: { value: number; change: number; trend: "up" | "down" };
    activeAgents: { value: number };
    criticalAlerts: { value: number; change: number; trend: "up" | "down" };
  };
  healthScores: Array<{
    agentId: string;
    agentName: string;
    score: number;
    status: "HEALTHY" | "WARNING" | "CRITICAL";
  }>;
  runVolume: Array<{ time: string; count: number }>;
  failureTrend: Array<{ time: string; rate: number }>;
  recentIssues: Array<{
    id: string;
    agentName: string;
    issueType: string;
    severity: "CRITICAL" | "WARNING";
    timestamp: string;
  }>;
}

/**
 * 2. 대시보드 상태(Status) API 응답 타입 정의
 */
export interface DashboardStatusMetricsDto {
  agentStatus: {
    healthy: number;
    warning: number;
    critical: number;
    offline: number;
  };
  modelStatus: Array<{
    model: string;
    successRate: number;
    avgLatency: number;
  }>;
  toolStatus: Array<{
    tool: string;
    successRate: number;
  }>;
  recentOutages: Array<{
    timestamp: string;
    component: string;
    error: string;
  }>;
  slo: {
    metricName: string;
    target: number;
    current: number;
    status: "COMPLIANT" | "NON_COMPLIANT";
  };
}

/**
 * 3. 대시보드 옵저버빌리티 지표(Metrics) API 응답 타입 정의
 */
export interface DashboardMetricsDataDto {
  runMetrics: {
    runsPerSec: number;
    tokensPerSec: number;
    requestsPerSec: number;
  };
  latencyDistribution: {
    p50: number;
    p95: number;
    p99: number;
  };
  tokenMetrics: {
    inputTokens: number;
    outputTokens: number;
  };
  errorRate: {
    toolError: number;
    llmError: number;
    validationError: number;
  };
  agentComparison: Array<{
    agentName: string;
    successRate: number;
    p95Latency: number;
    cost: number;
  }>;
}

/**
 * 4. 대시보드 사용 현황(Usage) API 응답 타입 정의
 */
export interface DashboardUsageMetricsDto {
  topAgents: Array<{ name: string; count: number }>;
  heatmap: Array<{ day: number; hour: number; count: number }>;
  userUsage: Array<{ userId: string; email: string; runs: number }>;
  toolUsage: Array<{ name: string; count: number }>;
  modelUsage: Array<{ name: string; count: number; tokens: number }>;
}

/**
 * 5. 대시보드 비용(Cost) API 응답 타입 정의
 */
export interface DashboardCostMetricsDto {
  totalCost: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  costBreakdown: {
    model: number;
    tool: number;
    storage: number;
  };
  costByAgent: Array<{ agentName: string; cost: number }>;
  costPerRun: {
    average: number;
    timeSeries: Array<{ date: string; avgCost: number }>;
  };
  costAnomalies: Array<{
    timestamp: string;
    model: string;
    percentageIncrease: number;
    description: string;
  }>;
}

/**
 * 6. 대시보드 인사이트(Insights) API 응답 타입 정의
 */
export interface DashboardInsightsDto {
  insights: Array<{
    id: string;
    type: string;
    severity: "CRITICAL" | "WARNING";
    timestamp: string;
    cause: string;
    impact: string;
    affectedAgentsCount: number;
    details: {
      summary: string;
      rcaLink: string;
    };
  }>;
}
