import type {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from "@repo/dto";

const now = Date.now();

const largeAgentNames = [
  "ResearchBot",
  "SupportBot",
  "SalesOps Agent",
  "InvoiceBot",
  "PolicyReview Agent",
  "DataOps Agent",
  "ComplianceBot",
  "CustomerSuccess Agent",
  "Retriever Agent",
  "IncidentTriage Agent",
  "BillingBot",
  "Onboarding Agent",
  "SearchQA Agent",
  "EscalationBot",
  "KnowledgeSync Agent",
  "WorkflowPlanner",
];

const issueTemplates = [
  ["Slack API Timeout", "ResearchBot", "CRITICAL", 214, 386],
  ["Tool retry loop detected", "IncidentTriage Agent", "CRITICAL", 168, 244],
  ["Prompt injection attempt blocked", "SupportBot", "CRITICAL", 142, 198],
  ["CRM enrichment latency spike", "SalesOps Agent", "WARNING", 126, 176],
  ["Context window truncation", "Retriever Agent", "WARNING", 118, 141],
  ["Payment data access denied", "ComplianceBot", "CRITICAL", 86, 112],
  ["Memory miss rate increased", "KnowledgeSync Agent", "WARNING", 74, 98],
  ["Policy approval queue backlog", "PolicyReview Agent", "WARNING", 69, 83],
  ["Database read timeout", "DataOps Agent", "CRITICAL", 58, 71],
  ["Model fallback activated", "CustomerSuccess Agent", "WARNING", 43, 52],
] as const;

const demoHours = Array.from({ length: 72 }, (_, index) => {
  const date = new Date(now - (71 - index) * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
});

export const dashboardDemoHome: DashboardHomeMetricsDto = {
  kpis: {
    agentRuns: { value: 428_640, change: 18.7, trend: "up" },
    successRate: { value: 96.8, change: -1.1, trend: "down" },
    avgLatency: { value: 2.84, change: 0.42, trend: "up" },
    cost: { value: 12842.72, change: 16.4, trend: "up" },
    activeAgents: { value: 184 },
    criticalAlerts: { value: 37, change: 12, trend: "up" },
  },
  healthScores: largeAgentNames.map((agentName, index) => {
    const score = Math.max(52, 99 - index * 3 - (index % 4) * 4);
    return {
      agentId: `demo-agent-${index + 1}`,
      agentName,
      score,
      status: score >= 90 ? "HEALTHY" : score >= 75 ? "WARNING" : "CRITICAL",
    };
  }),
  runVolume: demoHours.map((time, index) => {
    const hour = new Date(time).getHours();
    const businessHourBoost = hour >= 8 && hour <= 20 ? 2800 : 850;
    const dailyWave = Math.max(0, Math.sin(index / 5)) * 1450;
    const incidentSpike = index >= 58 && index <= 66 ? 1800 : 0;
    const count = Math.floor(
      4200 + businessHourBoost + dailyWave + incidentSpike,
    );
    const failureRatio =
      index >= 58 && index <= 66
        ? 0.082 + (index - 58) * 0.004
        : 0.024 + (index % 7) * 0.002;
    const failedCount = Math.floor(count * failureRatio);
    return {
      time,
      count,
      successCount: count - failedCount,
      failedCount,
    };
  }),
  failureTrend: demoHours.map((time, index) => {
    const incident = index >= 58 && index <= 66;
    const rate = incident
      ? 8.2 + (index - 58) * 0.7
      : 2.1 + Math.max(0, Math.sin(index / 6)) * 1.4;
    const previousRate = incident
      ? 3.1 + (index - 58) * 0.15
      : 1.8 + Math.max(0, Math.cos(index / 7)) * 1.1;
    return {
      time,
      rate: Number(rate.toFixed(2)),
      previousRate: Number(previousRate.toFixed(2)),
    };
  }),
  recentIssues: issueTemplates.map(
    (
      [issueType, agentName, severity, occurrenceCount, affectedSessionsCount],
      index,
    ) => ({
      id: `demo-issue-${index + 1}`,
      agentName,
      issueType,
      severity,
      timestamp: new Date(now - (index * 11 + 6) * 60 * 1000).toISOString(),
      occurrenceCount,
      affectedSessionsCount,
      lastSeenAt: new Date(now - (index * 7 + 3) * 60 * 1000).toISOString(),
    }),
  ),
};

export const dashboardDemoMetrics: DashboardMetricsDataDto = {
  runMetrics: {
    runsPerSec: 186.4,
    tokensPerSec: 1_248_000,
    requestsPerSec: 427.8,
  },
  latencyDistribution: {
    p50: 740,
    p95: 3180,
    p99: 9200,
  },
  tokenMetrics: {
    inputTokens: 42_800_000,
    outputTokens: 11_640_000,
  },
  errorRate: {
    toolError: 2.8,
    llmError: 0.7,
    validationError: 1.1,
  },
  agentComparison: [
    {
      agentName: "ResearchBot",
      successRate: 93.4,
      p95Latency: 3120,
      cost: 1842.22,
    },
    {
      agentName: "SupportBot",
      successRate: 97.1,
      p95Latency: 1860,
      cost: 1208.48,
    },
    {
      agentName: "SalesOps Agent",
      successRate: 95.8,
      p95Latency: 2410,
      cost: 973.34,
    },
    {
      agentName: "IncidentTriage Agent",
      successRate: 90.7,
      p95Latency: 5420,
      cost: 891.02,
    },
    {
      agentName: "InvoiceBot",
      successRate: 91.2,
      p95Latency: 4280,
      cost: 691.28,
    },
    {
      agentName: "ComplianceBot",
      successRate: 94.6,
      p95Latency: 3840,
      cost: 584.76,
    },
  ],
};

export const dashboardDemoUsage: DashboardUsageMetricsDto = {
  topAgents: [
    { name: "ResearchBot", count: 118_400 },
    { name: "SupportBot", count: 94_200 },
    { name: "SalesOps Agent", count: 72_930 },
    { name: "IncidentTriage Agent", count: 51_880 },
    { name: "InvoiceBot", count: 46_620 },
    { name: "ComplianceBot", count: 38_540 },
  ],
  heatmap: Array.from({ length: 7 * 24 }, (_, index) => {
    const day = Math.floor(index / 24);
    const hour = index % 24;
    const workHourBoost = hour >= 9 && hour <= 18 ? 1800 : 420;
    const weekdayBoost = day < 5 ? 1100 : 260;
    return {
      day,
      hour,
      count: Math.max(0, workHourBoost + weekdayBoost + ((day * hour) % 11)),
    };
  }),
  environmentUsage: [
    { environment: "production", runs: 382_480 },
    { environment: "staging", runs: 38_840 },
    { environment: "preview", runs: 12_320 },
    { environment: "development", runs: 4_180 },
  ],
  toolUsage: [
    { name: "Slack", count: 192_000 },
    { name: "Postgres", count: 176_000 },
    { name: "CRM", count: 154_000 },
    { name: "Search", count: 148_000 },
    { name: "Google Drive", count: 83_000 },
    { name: "Payments API", count: 42_000 },
  ],
  modelUsage: [
    { name: "gpt-5", count: 182_000, tokens: 31_200_000 },
    { name: "gpt-5-mini", count: 248_000, tokens: 17_400_000 },
    { name: "embedding-3-large", count: 98_000, tokens: 5_840_000 },
  ],
};

export const dashboardDemoStatus: DashboardStatusMetricsDto = {
  agentStatus: {
    healthy: 146,
    warning: 31,
    critical: 7,
    offline: 4,
  },
  modelStatus: [
    { model: "gpt-5", successRate: 98.2, avgLatency: 1740 },
    { model: "gpt-5-mini", successRate: 99.1, avgLatency: 820 },
    { model: "embedding-3-large", successRate: 99.8, avgLatency: 210 },
  ],
  toolStatus: [
    { tool: "Slack", successRate: 93.8 },
    { tool: "Postgres", successRate: 99.3 },
    { tool: "CRM", successRate: 96.5 },
    { tool: "Search", successRate: 97.4 },
  ],
  recentOutages: [
    {
      timestamp: new Date(now - 42 * 60 * 1000).toISOString(),
      component: "Slack",
      error: "API timeout increased tool failures for ResearchBot.",
    },
    {
      timestamp: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      component: "InvoiceBot",
      error: "Validation policy blocked malformed invoice payloads.",
    },
  ],
  slo: {
    metricName: "Agent run success rate",
    target: 99,
    current: 96.8,
    status: "NON_COMPLIANT",
  },
};

export const dashboardDemoCost: DashboardCostMetricsDto = {
  totalCost: {
    today: 42.18,
    thisWeek: 318.72,
    thisMonth: 1284.49,
  },
  costBreakdown: {
    model: 836.4,
    tool: 312.7,
    storage: 135.39,
  },
  costByAgent: [
    { agentName: "ResearchBot", cost: 384.2 },
    { agentName: "SupportBot", cost: 294.8 },
    { agentName: "SalesOps Agent", cost: 226.5 },
    { agentName: "InvoiceBot", cost: 142.1 },
  ],
  costPerRun: {
    average: 0.083,
    timeSeries: Array.from({ length: 7 }, (_, index) => ({
      date: new Date(now - (6 - index) * 24 * 60 * 60 * 1000).toISOString(),
      avgCost: Number((0.061 + index * 0.004 + (index % 2) * 0.007).toFixed(3)),
    })),
  },
  costAnomalies: [
    {
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      model: "gpt-5",
      percentageIncrease: 24.6,
      description: "ResearchBot retried long Slack-backed context runs.",
    },
  ],
};

export const dashboardDemoInsights: DashboardInsightsDto = {
  insights: [
    {
      id: "insight-1",
      type: "TOOL_FAILURE",
      severity: "CRITICAL",
      timestamp: new Date(now - 42 * 60 * 1000).toISOString(),
      cause: "Slack API timeout",
      impact: "42 sessions affected in the last hour.",
      affectedAgentsCount: 2,
      details: {
        summary:
          "ResearchBot and SupportBot runs are failing when Slack channel reads exceed the configured timeout.",
        rcaLink: "/debug/root-cause/demo-session-1",
      },
    },
    {
      id: "insight-2",
      type: "LATENCY_SPIKE",
      severity: "WARNING",
      timestamp: new Date(now - 90 * 60 * 1000).toISOString(),
      cause: "Long context retrieval",
      impact: "p95 latency increased for SalesOps Agent.",
      affectedAgentsCount: 1,
      details: {
        summary:
          "CRM enrichment queries are returning larger payloads than usual and increasing model input tokens.",
        rcaLink: "/debug/bottleneck/LLM%3Agpt-5",
      },
    },
  ],
};
