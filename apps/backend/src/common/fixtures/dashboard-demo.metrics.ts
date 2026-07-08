import {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from '@repo/dto';

export function getDemoHomeMetrics(): DashboardHomeMetricsDto {
  const agentNames = [
    'ResearchBot',
    'SupportBot',
    'SalesOps Agent',
    'InvoiceBot',
    'PolicyReview Agent',
    'DataOps Agent',
    'ComplianceBot',
    'CustomerSuccess Agent',
    'Retriever Agent',
    'IncidentTriage Agent',
    'BillingBot',
    'Onboarding Agent',
    'SearchQA Agent',
    'EscalationBot',
    'KnowledgeSync Agent',
    'WorkflowPlanner',
  ];
  const issues = [
    ['Slack API Timeout', 'ResearchBot', 'CRITICAL', 214, 386],
    ['Tool retry loop detected', 'IncidentTriage Agent', 'CRITICAL', 168, 244],
    ['Prompt injection attempt blocked', 'SupportBot', 'CRITICAL', 142, 198],
    ['CRM enrichment latency spike', 'SalesOps Agent', 'WARNING', 126, 176],
    ['Context window truncation', 'Retriever Agent', 'WARNING', 118, 141],
    ['Payment data access denied', 'ComplianceBot', 'CRITICAL', 86, 112],
    ['Memory miss rate increased', 'KnowledgeSync Agent', 'WARNING', 74, 98],
    ['Policy approval queue backlog', 'PolicyReview Agent', 'WARNING', 69, 83],
    ['Database read timeout', 'DataOps Agent', 'CRITICAL', 58, 71],
    ['Model fallback activated', 'CustomerSuccess Agent', 'WARNING', 43, 52],
  ] as const;
  const hours = Array.from({ length: 72 }).map((_, i) => {
    const d = new Date();
    d.setHours(d.getHours() - (71 - i));
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  });

  return {
    kpis: {
      agentRuns: { value: 428640, change: 18.7, trend: 'up' as const },
      successRate: { value: 96.8, change: -1.1, trend: 'down' as const },
      avgLatency: { value: 2.84, change: 0.42, trend: 'up' as const },
      cost: { value: 12842.72, change: 16.4, trend: 'up' as const },
      activeAgents: { value: 184 },
      criticalAlerts: { value: 37, change: 12, trend: 'up' as const },
    },
    healthScores: agentNames.map((agentName, index) => {
      const score = Math.max(52, 99 - index * 3 - (index % 4) * 4);
      return {
        agentId: `demo-agent-${index + 1}`,
        agentName,
        score,
        status:
          score >= 90
            ? ('HEALTHY' as const)
            : score >= 75
              ? ('WARNING' as const)
              : ('CRITICAL' as const),
      };
    }),
    runVolume: hours.map((hour, idx) => {
      const eventHour = new Date(hour).getHours();
      const businessHourBoost = eventHour >= 8 && eventHour <= 20 ? 2800 : 850;
      const dailyWave = Math.max(0, Math.sin(idx / 5)) * 1450;
      const incidentSpike = idx >= 58 && idx <= 66 ? 1800 : 0;
      const count = Math.floor(
        4200 + businessHourBoost + dailyWave + incidentSpike,
      );
      const failureRatio =
        idx >= 58 && idx <= 66
          ? 0.082 + (idx - 58) * 0.004
          : 0.024 + (idx % 7) * 0.002;
      const failedCount = Math.floor(count * failureRatio);
      const successCount = count - failedCount;

      return {
        time: hour,
        count: successCount + failedCount,
        successCount,
        failedCount,
      };
    }),
    failureTrend: hours.map((hour, idx) => {
      const incident = idx >= 58 && idx <= 66;
      const rate = incident
        ? 8.2 + (idx - 58) * 0.7
        : 2.1 + Math.max(0, Math.sin(idx / 6)) * 1.4;
      const previousRate = incident
        ? 3.1 + (idx - 58) * 0.15
        : 1.8 + Math.max(0, Math.cos(idx / 7)) * 1.1;

      return {
        time: hour,
        rate: parseFloat(rate.toFixed(2)),
        previousRate: parseFloat(previousRate.toFixed(2)),
      };
    }),
    recentIssues: issues.map(
      (
        [
          issueType,
          agentName,
          severity,
          occurrenceCount,
          affectedSessionsCount,
        ],
        index,
      ) => ({
        id: `demo-issue-${index + 1}`,
        agentName,
        issueType,
        severity,
        timestamp: new Date(
          Date.now() - (index * 11 + 6) * 60 * 1000,
        ).toISOString(),
        occurrenceCount,
        affectedSessionsCount,
        lastSeenAt: new Date(
          Date.now() - (index * 7 + 3) * 60 * 1000,
        ).toISOString(),
      }),
    ),
  };
}

export function getDemoStatusMetrics(): DashboardStatusMetricsDto {
  return {
    agentStatus: {
      healthy: 12,
      warning: 4,
      critical: 2,
      offline: 0,
    },
    modelStatus: getDefaultModelStatus(),
    toolStatus: getDefaultToolStatus(),
    recentOutages: [
      {
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        component: 'Slack API Integration',
        error: 'Slack API Timeout (504 Gateway Timeout)',
      },
      {
        timestamp: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
        component: 'GPT-5 Model',
        error: 'Context Overflow (Token Limit Exceeded)',
      },
    ],
    slo: {
      metricName: 'Success Rate',
      target: 95.0,
      current: 96.2,
      status: 'COMPLIANT' as const,
    },
  };
}

export function getDemoMetricsData(): DashboardMetricsDataDto {
  return {
    runMetrics: {
      runsPerSec: 15.4,
      tokensPerSec: 84200,
      requestsPerSec: 32.1,
    },
    latencyDistribution: {
      p50: 1.8,
      p95: 4.5,
      p99: 9.2,
    },
    tokenMetrics: {
      inputTokens: 48200100,
      outputTokens: 12840900,
    },
    errorRate: {
      toolError: 42,
      llmError: 18,
      validationError: 5,
    },
    agentComparison: getDefaultAgentComparison(),
  };
}

export function getDemoUsageMetrics(): DashboardUsageMetricsDto {
  const heatmap: Array<{ day: number; hour: number; count: number }> = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const weight = hour >= 9 && hour <= 18 ? 5.0 : 1.0;
      heatmap.push({
        day,
        hour,
        count: Math.floor(Math.random() * 50 * weight),
      });
    }
  }

  return {
    topAgents: getDefaultTopAgents(),
    heatmap,
    environmentUsage: [
      { environment: 'production', runs: 520 },
      { environment: 'staging', runs: 190 },
      { environment: 'preview', runs: 60 },
    ],
    toolUsage: getDefaultToolUsage(),
    modelUsage: getDefaultModelUsage(),
  };
}

export function getDemoCostMetrics(): DashboardCostMetricsDto {
  return {
    totalCost: {
      today: 127.42,
      thisWeek: 842.1,
      thisMonth: 3240.5,
    },
    costBreakdown: {
      model: 84.22,
      tool: 32.1,
      storage: 11.1,
    },
    costByAgent: getDefaultCostByAgent(),
    costPerRun: {
      average: 0.0125,
      timeSeries: [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          avgCost: 0.012,
        },
        { date: new Date().toISOString().split('T')[0], avgCost: 0.0125 },
      ],
    },
    costAnomalies: getDefaultCostAnomalies(),
  };
}

export function getDemoInsights(): DashboardInsightsDto {
  return {
    insights: [
      {
        id: 'ins-901',
        type: 'Failure Spike Detected',
        severity: 'CRITICAL' as const,
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        cause: 'After deployment of Prompt v23',
        impact: 'Success rate collapsed from 96% to 82%',
        affectedAgentsCount: 5,
        details: {
          summary:
            'SalesBot and 4 other agents experienced successive Intent Misclassification and validation errors immediately following the deployment of Prompt version v23.',
          rcaLink: '/debug/root-cause?issueId=ins-901',
        },
      },
      {
        id: 'ins-902',
        type: 'Cost Spike Warning',
        severity: 'WARNING' as const,
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        cause: 'Google Drive Tool Infinite Loop',
        impact: 'Average agent execution cost increased from $0.012 to $0.085',
        affectedAgentsCount: 2,
        details: {
          summary:
            'Missing retry backoff parameters caused an infinite loop in file search API invocations during Google Drive connection timeouts.',
          rcaLink: '/debug/bottleneck?issueId=ins-902',
        },
      },
    ],
  };
}

function getDefaultModelStatus() {
  return [
    { model: 'GPT-5', successRate: 99.4, avgLatency: 3.1 },
    { model: 'Claude Sonnet', successRate: 96.2, avgLatency: 2.8 },
    { model: 'Gemini', successRate: 98.1, avgLatency: 1.9 },
  ];
}

function getDefaultToolStatus() {
  return [
    { tool: 'Notion', successRate: 99.1 },
    { tool: 'Slack', successRate: 94.5 },
    { tool: 'CRM', successRate: 98.0 },
    { tool: 'Database', successRate: 100.0 },
  ];
}

function getDefaultAgentComparison() {
  return [
    {
      agentName: 'SupportBot',
      successRate: 98.2,
      p95Latency: 2.5,
      cost: 42.1,
    },
    { agentName: 'SalesBot', successRate: 92.4, p95Latency: 5.8, cost: 76.5 },
  ];
}

function getDefaultTopAgents() {
  return [
    { name: 'Customer Support', count: 6420 },
    { name: 'Sales Agent', count: 3120 },
    { name: 'Research Agent', count: 1890 },
  ];
}

function getDefaultToolUsage() {
  return [
    { name: 'Slack', count: 12800 },
    { name: 'Notion', count: 4820 },
    { name: 'Google Drive', count: 2100 },
  ];
}

function getDefaultModelUsage() {
  return [
    { name: 'GPT-5', count: 15400, tokens: 84200000 },
    { name: 'Claude', count: 8900, tokens: 32100000 },
    { name: 'Gemini', count: 4200, tokens: 1540000 },
  ];
}

function getDefaultCostByAgent() {
  return [
    { agentName: 'SupportBot', cost: 34.0 },
    { agentName: 'ResearchBot', cost: 82.0 },
  ];
}

function getDefaultCostAnomalies() {
  return [
    {
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      model: 'GPT-5',
      percentageIncrease: 47.0,
      description:
        'Today GPT cost increased by 47% (Potential massive retry loop detected)',
    },
  ];
}
