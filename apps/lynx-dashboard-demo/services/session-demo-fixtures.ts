import type {
  SessionDetailResponseDto,
  SessionListQueryDto,
  SessionListItemDto,
  SessionListResponseDto,
  SessionPageKind,
  SessionTimelineResponseDto,
} from "@repo/dto";

const now = Date.now();
const isoMinutesAgo = (minutes: number) =>
  new Date(now - minutes * 60 * 1000).toISOString();

const agents = ["ResearchBot", "SupportBot", "BillingAgent", "OpsAgent"];

export const demoSessionList: SessionListResponseDto = {
  overview: {
    totalSessions: 84,
    runningSessions: 7,
    completedSessions: 61,
    failedSessions: 9,
    anomalySessions: 14,
    successRate: 0.84,
    avgDurationMs: 8420,
    totalCost: 142.38,
    totalTokens: 843200,
    topIssue: "Tool timeout",
    topAgent: "ResearchBot",
  },
  sessions: Array.from({ length: 36 }, (_, index) => {
    const failed = index % 9 === 0;
    const running = index % 13 === 0;
    const anomaly = index % 5 === 0;
    const agentName = agents[index % agents.length] ?? "ResearchBot";
    const sessionId = `demo-session-${index + 1}`;

    return {
      sessionId,
      runId: `run-${3100 + index}`,
      traceId: `trace-${3100 + index}`,
      agentId: `agent-${index % agents.length}`,
      agentName,
      status: running ? "RUNNING" : failed ? "FAILED" : "COMPLETED",
      severity: failed ? "CRITICAL" : anomaly ? "WARNING" : "INFO",
      environment: index % 4 === 0 ? "staging" : "production",
      startedAt: isoMinutesAgo(index * 8 + 2),
      endedAt: running ? undefined : isoMinutesAgo(index * 8),
      durationMs: running ? 72000 + index * 800 : 3800 + index * 420,
      llmCallCount: 2 + (index % 6),
      toolCallCount: 1 + (index % 8),
      retryCount: failed ? 3 : anomaly ? 2 : index % 2,
      errorCount: failed ? 1 : 0,
      guardrailCount: index % 7 === 0 ? 1 : 0,
      totalTokens: 2400 + index * 360,
      totalCost: Number((0.032 + index * 0.018).toFixed(3)),
      primaryIssue: failed
        ? "Tool timeout"
        : anomaly
          ? "High latency"
          : undefined,
      rootCauseCandidate: failed
        ? "Slack tool timed out after retry x3."
        : anomaly
          ? "Context loading and tool retry increased latency."
          : undefined,
      issueBadges: failed
        ? [
            {
              label: "Tool timeout",
              type: "TOOL_TIMEOUT",
              tone: "bad",
              reason: "Slack API returned timeout after retries.",
            },
            {
              label: "Retry x3",
              type: "MANY_RETRIES",
              tone: "warning",
            },
          ]
        : anomaly
          ? [
              {
                label: "High latency",
                type: "HIGH_LATENCY",
                tone: "warning",
              },
            ]
          : [],
      relatedDebugLinks: [
        {
          label: "추론 트레이스",
          href: `/debug/trace/${sessionId}`,
          kind: "trace",
        },
        {
          label: "재현 환경",
          href: `/debug/reproduce/${sessionId}`,
          kind: "reproduce",
        },
      ],
    };
  }),
  page: { hasMore: true, total: 84 },
};

export function getDemoSessionList(
  kind: SessionPageKind,
  query?: Partial<SessionListQueryDto>,
): SessionListResponseDto {
  const sessions = applyDemoFilters(
    demoSessionList.sessions.filter((session) => matchesKind(session, kind)),
    query,
  );

  return {
    ...demoSessionList,
    overview: createDemoOverview(sessions),
    sessions,
    page: { hasMore: false, total: sessions.length },
  };
}

function matchesKind(session: SessionListItemDto, kind: SessionPageKind) {
  if (kind === "overview") return true;
  if (kind === "live") return session.status === "RUNNING";
  if (kind === "completed") {
    return session.status === "COMPLETED" && session.severity !== "CRITICAL";
  }
  if (kind === "failed") {
    return session.status === "FAILED" || session.severity === "CRITICAL";
  }
  return session.status !== "FAILED" && session.issueBadges.length > 0;
}

function applyDemoFilters(
  sessions: SessionListItemDto[],
  query?: Partial<SessionListQueryDto>,
) {
  if (!query) return sessions;
  const agent = query.agent?.trim().toLowerCase();
  const environment = query.environment?.trim().toLowerCase();
  const traceId = query.traceId?.trim().toLowerCase();
  const search = query.search?.trim().toLowerCase();

  return sessions.filter((session) => {
    if (query.status && session.status !== query.status) return false;
    if (query.agentId && session.agentId !== query.agentId) return false;
    if (query.sessionId && session.sessionId !== query.sessionId) return false;
    if (query.runId && session.runId !== query.runId) return false;
    if (agent && !matchesText([session.agentName, session.agentId], agent)) {
      return false;
    }
    if (environment && !matchesText([session.environment], environment)) {
      return false;
    }
    if (traceId && !matchesText([session.traceId], traceId)) return false;
    if (search && !matchesSessionSearch(session, search)) return false;
    return true;
  });
}

function matchesSessionSearch(session: SessionListItemDto, search: string) {
  return matchesText(
    [
      session.sessionId,
      session.runId,
      session.traceId,
      session.agentId,
      session.agentName,
      session.environment,
      session.status,
      session.severity,
      session.primaryIssue,
      session.rootCauseCandidate,
      ...session.issueBadges.flatMap((badge) => [
        badge.label,
        badge.type,
        badge.reason,
      ]),
    ],
    search,
  );
}

function matchesText(values: Array<string | undefined>, search: string) {
  return values.some((value) => value?.toLowerCase().includes(search));
}

function createDemoOverview(sessions: SessionListItemDto[]) {
  const completed = sessions.filter(
    (session) => session.status === "COMPLETED",
  );
  const failed = sessions.filter(
    (session) => session.status === "FAILED" || session.severity === "CRITICAL",
  );
  const anomalies = sessions.filter(
    (session) => session.issueBadges.length > 0,
  );
  const durations = sessions
    .map((session) => session.durationMs)
    .filter((value): value is number => typeof value === "number");

  return {
    totalSessions: sessions.length,
    runningSessions: sessions.filter((session) => session.status === "RUNNING")
      .length,
    completedSessions: completed.length,
    failedSessions: failed.length,
    anomalySessions: anomalies.length,
    successRate:
      sessions.length === 0 ? null : completed.length / sessions.length,
    avgDurationMs:
      durations.length === 0
        ? null
        : durations.reduce((sum, value) => sum + value, 0) / durations.length,
    totalCost: sessions.reduce((sum, session) => sum + session.totalCost, 0),
    totalTokens: sessions.reduce(
      (sum, session) => sum + session.totalTokens,
      0,
    ),
    topIssue: mostCommon(sessions.map((session) => session.primaryIssue)),
    topAgent: mostCommon(sessions.map((session) => session.agentName)),
  };
}

function mostCommon(values: Array<string | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  let winner: string | undefined;
  let max = 0;
  counts.forEach((count, value) => {
    if (count > max) {
      winner = value;
      max = count;
    }
  });
  return winner;
}

export const demoSessionDetail: SessionDetailResponseDto = {
  ...demoSessionList.sessions[0]!,
  finalOutputPreview: "The agent failed before producing a final response.",
  inputPreview: "Summarize customer feedback and post the result to Slack.",
  modelNames: ["gpt-5", "gpt-5-mini"],
  toolNames: ["Slack", "CRM"],
  promptVersion: "research-v4",
  sdkVersion: "0.1.0",
  recommendedActions: [
    {
      label: "추론 트레이스 보기",
      href: "/debug/trace/demo-session-1",
      description: "실패 span과 critical path를 확인합니다.",
    },
    {
      label: "재현 환경 열기",
      href: "/debug/reproduce/demo-session-1",
      description: "원본 실행과 dry-run 결과를 비교합니다.",
    },
  ],
};

export const demoSessionTimeline: SessionTimelineResponseDto = {
  session: demoSessionDetail,
  nodes: [
    {
      id: "node-input",
      eventId: "event-input",
      type: "user_input",
      label: "User request",
      status: "success",
      timestamp: isoMinutesAgo(16),
      preview: "Summarize customer feedback and post it to Slack.",
      issueBadges: [],
      detail: { inputPreview: demoSessionDetail.inputPreview },
    },
    {
      id: "node-context",
      eventId: "event-context",
      type: "context_load",
      label: "Load CRM context",
      status: "success",
      timestamp: isoMinutesAgo(15),
      latencyMs: 860,
      tokenCount: 1620,
      preview: "Loaded customer plan, recent tickets, and account owner.",
      issueBadges: [],
      detail: { source: "CRM", tokenCount: 1620 },
    },
    {
      id: "node-llm",
      eventId: "event-llm",
      type: "llm_call",
      label: "Plan next action",
      status: "success",
      timestamp: isoMinutesAgo(14),
      latencyMs: 1420,
      tokenCount: 2200,
      cost: 0.048,
      model: "gpt-5",
      provider: "OpenAI",
      preview: "Agent decided to fetch Slack channel metadata.",
      issueBadges: [],
      detail: {
        model: "gpt-5",
        inputPreview: "Customer feedback summary task.",
        outputPreview: "Call Slack lookup before posting.",
      },
    },
    {
      id: "node-tool",
      eventId: "event-tool",
      type: "tool_call",
      label: "Slack postMessage",
      status: "error",
      timestamp: isoMinutesAgo(12),
      latencyMs: 12000,
      toolName: "Slack",
      preview: "Slack API timed out after retry x3.",
      issueBadges: [
        {
          label: "Tool timeout",
          type: "TOOL_TIMEOUT",
          tone: "bad",
          reason: "Slack API returned 504 after retries.",
        },
      ],
      detail: {
        toolName: "Slack",
        argumentsPreview: '{"channel":"#support","text":"..."}',
        error: "504 Gateway Timeout",
        retryCount: 3,
      },
    },
    {
      id: "node-final",
      eventId: "event-final",
      type: "final_response",
      label: "Session failed",
      status: "error",
      timestamp: isoMinutesAgo(11),
      preview: "Session ended with failed status.",
      issueBadges: [
        {
          label: "Failed",
          type: "SESSION_FAILED",
          tone: "bad",
        },
      ],
      detail: { status: "FAILED" },
    },
  ],
  edges: [
    {
      id: "e1",
      source: "node-input",
      target: "node-context",
      status: "normal",
    },
    { id: "e2", source: "node-context", target: "node-llm", status: "normal" },
    {
      id: "e3",
      source: "node-llm",
      target: "node-tool",
      status: "error",
      label: "tool call",
    },
    { id: "e4", source: "node-tool", target: "node-final", status: "error" },
  ],
  criticalNodeIds: ["node-llm", "node-tool", "node-final"],
  failedNodeId: "node-tool",
};
