import type {
  AgentDetailResponseDto,
  AgentListItemDto,
  AgentListQueryDto,
  AgentListResponseDto,
  AgentPageKind,
} from "@repo/dto";

const now = Date.now();
const hour = 60 * 60 * 1000;

const names = [
  "ResearchBot",
  "SupportBot",
  "BillingAgent",
  "SalesOps Agent",
  "IncidentTriage Agent",
  "PolicyReview Agent",
  "Retriever Agent",
  "CustomerSuccess Agent",
  "KnowledgeSync Agent",
  "InvoiceBot",
  "SearchQA Agent",
  "DataOps Agent",
];

export const demoAgents: AgentListItemDto[] = names.map((name, index) => {
  const totalSessions = 840 - index * 37;
  const failed = index % 4 === 0 ? 41 + index : index % 3 === 0 ? 18 : 6;
  const successRate = (totalSessions - failed) / totalSessions;
  const avgLatencyMs = 980 + index * 210 + (index % 4 === 0 ? 2600 : 0);
  const totalCost = 18.4 + index * 9.7 + (index % 5 === 0 ? 52 : 0);
  const totalTokens = 140_000 + index * 53_200;
  const status =
    index % 7 === 0
      ? "CRITICAL"
      : index % 3 === 0
        ? "WARNING"
        : index % 8 === 0
          ? "INACTIVE"
          : "ACTIVE";
  const issueBadges =
    status === "CRITICAL"
      ? [
          {
            label: "Tool timeout",
            type: "TOOL_TIMEOUT",
            tone: "bad" as const,
            reason: "Slack and CRM tool calls timed out repeatedly.",
          },
          {
            label: "Retry loop",
            type: "RETRY_LOOP",
            tone: "warning" as const,
          },
        ]
      : status === "WARNING"
        ? [
            {
              label: "Latency spike",
              type: "HIGH_LATENCY",
              tone: "warning" as const,
            },
          ]
        : [];

  return {
    agentId: `demo-agent-${index + 1}`,
    name,
    description:
      index % 2 === 0
        ? "고객 요청을 분석하고 외부 도구를 호출하는 운영 에이전트입니다."
        : "내부 지식과 SaaS 데이터를 결합해 업무 흐름을 자동화합니다.",
    role: index % 3 === 0 ? "Operations" : index % 3 === 1 ? "Support" : "Research",
    owner: ["Platform", "CS", "Growth", "Ops"][index % 4],
    team: ["AI Ops", "Customer", "Revenue"][index % 3],
    group: ["production", "support", "growth"][index % 3],
    status,
    environment: index % 5 === 0 ? "staging" : "production",
    version: `v${24 - (index % 5)}`,
    defaultModel: index % 2 === 0 ? "gpt-5" : "claude-sonnet-4",
    lastActiveAt:
      status === "INACTIVE"
        ? new Date(now - 12 * 24 * hour).toISOString()
        : new Date(now - index * hour).toISOString(),
    lastRunAt:
      status === "INACTIVE"
        ? new Date(now - 12 * 24 * hour).toISOString()
        : new Date(now - index * hour).toISOString(),
    sessionCount24h: status === "INACTIVE" ? 0 : 68 - index * 3,
    totalSessions,
    successRate,
    failureRate: 1 - successRate,
    avgLatencyMs,
    p95LatencyMs: avgLatencyMs * 2.4,
    totalCost,
    totalTokens,
    avgCostPerRun: totalCost / totalSessions,
    tokensPerSuccessfulRun: totalTokens / Math.max(totalSessions - failed, 1),
    llmCallCount: totalSessions * (2 + (index % 4)),
    toolCallCount: totalSessions * (1 + (index % 5)),
    guardrailCount: index % 4 === 0 ? 26 + index : index,
    errorCount: failed,
    retryCount: index % 4 === 0 ? 88 : 12 + index,
    connectedToolCount: 3 + (index % 5),
    models: index % 2 === 0 ? ["gpt-5", "gpt-4.1"] : ["claude-sonnet-4"],
    tools: ["slack.postMessage", "crm.lookup", "search.query", "db.read"].slice(
      0,
      2 + (index % 3),
    ),
    saasApps: ["Slack", "Salesforce", "Notion"].slice(0, 1 + (index % 3)),
    issueBadges,
    primaryIssue: issueBadges[0]?.type,
    recommendation:
      issueBadges[0]?.reason ??
      "최근 실행 기준으로 뚜렷한 이상 신호는 없습니다.",
    relatedLinks: [
      {
        label: "세션 보기",
        href: `/dashboard/session/overview?agentId=demo-agent-${index + 1}`,
        kind: "sessions",
      },
      {
        label: "디버깅",
        href: `/debug/logs?agentId=demo-agent-${index + 1}`,
        kind: "debug",
      },
    ],
    trend: Array.from({ length: 36 }, (_, bucketIndex) => {
      const failedCount =
        index % 4 === 0 && bucketIndex > 27 ? 7 + (bucketIndex % 3) : bucketIndex % 4;
      const successCount = 20 + ((bucketIndex + index) % 13);
      return {
        timestamp: new Date(now - (35 - bucketIndex) * hour).toISOString(),
        value: successCount + failedCount,
        successCount,
        failedCount,
        cost: Number((0.4 + index * 0.08 + bucketIndex * 0.02).toFixed(3)),
        tokens: 2200 + bucketIndex * 180 + index * 260,
        latencyMs: avgLatencyMs + Math.sin(bucketIndex / 3) * 240,
      };
    }),
  };
});

export function getDemoAgentList(
  kind: AgentPageKind,
  query: Partial<AgentListQueryDto>,
): AgentListResponseDto {
  const filtered = applyDemoFilters(
    filterDemoByKind(demoAgents, kind),
    query,
  );
  const limit = query.limit ?? 25;
  const visible = filtered.slice(0, limit);

  return {
    overview: {
      totalAgents: filtered.length,
      activeAgents: filtered.filter((agent) => agent.status === "ACTIVE").length,
      inactiveAgents: filtered.filter((agent) => agent.status === "INACTIVE").length,
      warningAgents: filtered.filter((agent) => agent.status === "WARNING").length,
      criticalAgents: filtered.filter((agent) => agent.status === "CRITICAL").length,
      sessions24h: filtered.reduce((sum, agent) => sum + agent.sessionCount24h, 0),
      avgSuccessRate: average(
        filtered
          .map((agent) => agent.successRate)
          .filter((value): value is number => typeof value === "number"),
      ),
      avgLatencyMs: average(
        filtered
          .map((agent) => agent.avgLatencyMs)
          .filter((value): value is number => typeof value === "number"),
      ),
      totalCost: filtered.reduce((sum, agent) => sum + agent.totalCost, 0),
      totalTokens: filtered.reduce((sum, agent) => sum + agent.totalTokens, 0),
      topIssue: filtered.find((agent) => agent.primaryIssue)?.primaryIssue,
      topAgent: filtered[0]?.name,
      recommendation:
        filtered.find((agent) => agent.status === "CRITICAL")?.recommendation ??
        "최근 에이전트 운영 상태가 안정적입니다.",
    },
    agents: visible,
    page: {
      hasMore: filtered.length > visible.length,
      total: filtered.length,
    },
  };
}

export function getDemoAgentDetail(
  agentId: string,
): AgentDetailResponseDto | undefined {
  const agent =
    demoAgents.find((item) => item.agentId === agentId) ?? demoAgents[0];
  if (!agent) return undefined;

  return {
    ...agent,
    recentSessions: Array.from({ length: 8 }, (_, index) => ({
      sessionId: `demo-session-${index + 1}`,
      runId: `run-${agent.name.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
      status: index % 5 === 0 ? "FAILED" : "COMPLETED",
      startedAt: new Date(now - index * hour).toISOString(),
      durationMs: (agent.avgLatencyMs ?? 1000) * (1 + index / 12),
      totalCost: Number((agent.avgCostPerRun ?? 0.02).toFixed(3)),
      totalTokens: Math.round(agent.totalTokens / Math.max(agent.totalSessions, 1)),
      primaryIssue: index % 5 === 0 ? agent.primaryIssue : undefined,
    })),
    toolUsage: agent.tools.map((toolName, index) => ({
      toolName,
      agentCount: 1,
      callCount: 420 - index * 48,
      successRate: index === 0 && agent.status === "CRITICAL" ? 0.87 : 0.98,
      avgLatencyMs: (agent.avgLatencyMs ?? 1000) * (0.6 + index / 5),
      timeoutCount: index === 0 && agent.status === "CRITICAL" ? 32 : index,
      sideEffect: index === 0 ? "external" : "read-only",
      relatedAgents: [agent.name],
    })),
    saasAccess: agent.saasApps.map((appName, index) => ({
      appName,
      agentCount: 1,
      callCount: 260 - index * 28,
      writeCount: index === 0 ? 44 : 3,
      failureCount: index === 0 && agent.status === "CRITICAL" ? 18 : 1,
      riskLevel: index === 0 ? "medium" : "low",
      relatedAgents: [agent.name],
    })),
    behaviorHistory: Array.from({ length: 10 }, (_, index) => ({
      id: `behavior-${agent.agentId}-${index}`,
      agentId: agent.agentId,
      agentName: agent.name,
      timestamp: new Date(now - index * hour).toISOString(),
      eventType: index % 4 === 0 ? "TOOL_CALL" : "LLM_CALL",
      summary:
        index % 4 === 0
          ? "Slack tool call retried before returning timeout."
          : "Agent selected the next tool based on retrieved context.",
      severity: index % 4 === 0 ? "WARNING" : "INFO",
      sessionId: `demo-session-${index + 1}`,
      traceId: `trace-${index + 1}`,
    })),
    performance: {
      latencyTrend: agent.trend.map((point) => ({
        timestamp: point.timestamp,
        value: point.latencyMs ?? 0,
        latencyMs: point.latencyMs,
      })),
      successTrend: agent.trend.map((point) => ({
        timestamp: point.timestamp,
        value:
          (point.successCount ?? 0) /
          Math.max((point.successCount ?? 0) + (point.failedCount ?? 0), 1),
        successCount: point.successCount,
        failedCount: point.failedCount,
      })),
      costTrend: agent.trend.map((point) => ({
        timestamp: point.timestamp,
        value: point.cost ?? 0,
        cost: point.cost,
      })),
      tokenTrend: agent.trend.map((point) => ({
        timestamp: point.timestamp,
        value: point.tokens ?? 0,
        tokens: point.tokens,
      })),
    },
    recommendations: [
      {
        title:
          agent.status === "CRITICAL"
            ? "실패 세션을 먼저 확인하세요"
            : "최근 운영 상태를 유지하세요",
        description: agent.recommendation ?? "",
        priority: agent.status === "CRITICAL" ? "HIGH" : "LOW",
        href: `/dashboard/session/failed?agentId=${agent.agentId}`,
      },
    ],
  };
}

function filterDemoByKind(agents: AgentListItemDto[], kind: AgentPageKind) {
  if (kind === "active") return agents.filter((agent) => agent.status !== "INACTIVE");
  if (kind === "inactive") return agents.filter((agent) => agent.status === "INACTIVE");
  if (kind === "latency") {
    return [...agents].sort((a, b) => (b.p95LatencyMs ?? 0) - (a.p95LatencyMs ?? 0));
  }
  if (kind === "tokens") return [...agents].sort((a, b) => b.totalTokens - a.totalTokens);
  if (kind === "success-rate") {
    return [...agents].sort((a, b) => (a.successRate ?? 1) - (b.successRate ?? 1));
  }
  if (kind === "cost") return [...agents].sort((a, b) => b.totalCost - a.totalCost);
  return agents;
}

function applyDemoFilters(
  agents: AgentListItemDto[],
  query: Partial<AgentListQueryDto>,
) {
  const search = query.search?.toLowerCase();
  return agents.filter((agent) => {
    if (query.status && agent.status !== query.status) return false;
    if (query.agentId && agent.agentId !== query.agentId) return false;
    if (query.agent && !agent.name.toLowerCase().includes(query.agent.toLowerCase())) {
      return false;
    }
    if (
      query.environment &&
      !agent.environment?.toLowerCase().includes(query.environment.toLowerCase())
    ) {
      return false;
    }
    if (query.model && !agent.models.some((model) => model.includes(query.model!))) {
      return false;
    }
    if (query.tool && !agent.tools.some((tool) => tool.includes(query.tool!))) {
      return false;
    }
    if (!search) return true;
    return [
      agent.name,
      agent.description,
      agent.group,
      agent.environment,
      agent.primaryIssue,
      ...agent.tools,
      ...agent.models,
      ...agent.saasApps,
    ].some((value) => value?.toLowerCase().includes(search));
  });
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

