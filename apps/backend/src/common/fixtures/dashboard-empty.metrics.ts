import {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from '@repo/dto';

export function getEmptyHomeMetrics(): DashboardHomeMetricsDto {
  return {
    kpis: {
      agentRuns: { value: 0, change: 0, trend: 'up' },
      successRate: { value: 0, change: 0, trend: 'up' },
      avgLatency: { value: 0, change: 0, trend: 'up' },
      cost: { value: 0, change: 0, trend: 'up' },
      activeAgents: { value: 0 },
      criticalAlerts: { value: 0, change: 0, trend: 'up' },
    },
    healthScores: [],
    runVolume: [],
    failureTrend: [],
    recentIssues: [],
  };
}

export function getEmptyStatusMetrics(): DashboardStatusMetricsDto {
  return {
    agentStatus: {
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    },
    modelStatus: [],
    toolStatus: [],
    recentOutages: [],
    slo: {
      metricName: 'Success Rate',
      target: 95,
      current: 0,
      status: 'NON_COMPLIANT',
    },
  };
}

export function getEmptyMetricsData(): DashboardMetricsDataDto {
  return {
    runMetrics: {
      runsPerSec: 0,
      tokensPerSec: 0,
      requestsPerSec: 0,
    },
    latencyDistribution: {
      p50: 0,
      p95: 0,
      p99: 0,
    },
    tokenMetrics: {
      inputTokens: 0,
      outputTokens: 0,
    },
    errorRate: {
      toolError: 0,
      llmError: 0,
      validationError: 0,
    },
    agentComparison: [],
  };
}

export function getEmptyUsageMetrics(): DashboardUsageMetricsDto {
  return {
    topAgents: [],
    heatmap: [],
    environmentUsage: [],
    toolUsage: [],
    modelUsage: [],
  };
}

export function getEmptyCostMetrics(): DashboardCostMetricsDto {
  return {
    totalCost: {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
    },
    costBreakdown: {
      model: 0,
      tool: 0,
      storage: 0,
    },
    costByAgent: [],
    costPerRun: {
      average: 0,
      timeSeries: [],
    },
    costAnomalies: [],
  };
}

export function getEmptyInsights(): DashboardInsightsDto {
  return {
    insights: [],
  };
}
