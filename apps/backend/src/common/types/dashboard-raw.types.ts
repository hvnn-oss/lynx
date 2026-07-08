export interface RawKpiMetrics {
  runs?: string;
  cost?: string;
  activeAgents?: string;
  completedRuns?: string;
  tokens?: string;
}

export interface RawLatencyMetrics {
  avg?: string;
}

export interface RawAgentHealth {
  agentId: string;
  agentName: string;
  totalRuns: string;
  failedRuns: string;
}

export interface RawTimeSeries {
  hour: string;
  count?: string;
  failed?: string;
}

export interface RawModelMetrics {
  modelName: string | null;
  totalCalls: string;
  errorCalls: string;
  avgLatency: string | null;
}

export interface RawToolMetrics {
  toolName: string | null;
  totalCalls: string;
  errorCalls: string;
}

export interface RawPercentiles {
  p50: string | null;
  p95: string | null;
  p99: string | null;
}

export interface RawTokenMetrics {
  input: string | null;
  output: string | null;
}

export interface RawAgentComparison {
  agentName: string | null;
  completed: string;
  total: string;
  cost: string | null;
  p95Latency?: string | null;
}

export interface RawRecentIssue {
  id: string;
  agentName: string | null;
  issueType: string | null;
  severity: 'CRITICAL' | 'WARNING';
  occurrenceCount: string;
  affectedSessionsCount: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface RawEnvironmentUsage {
  environment: string | null;
  runs: string;
}
