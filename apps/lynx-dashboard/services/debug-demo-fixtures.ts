import type {
  DebugBottleneckResponseDto,
  DebugErrorGroupListResponseDto,
  DebugEventLogResponseDto,
  DebugFailurePatternResponseDto,
  DebugLatencyResponseDto,
  DebugLlmCallListResponseDto,
  DebugMemoryResponseDto,
  DebugReproduceResponseDto,
  DebugRootCauseResponseDto,
  DebugSessionListResponseDto,
  DebugTimelineResponseDto,
  DebugToolCallListResponseDto,
} from "@repo/dto";

const now = Date.now();
const isoMinutesAgo = (minutes: number) =>
  new Date(now - minutes * 60 * 1000).toISOString();
const demoAgents = [
  "ResearchBot",
  "SupportBot",
  "BillingAgent",
  "OpsAgent",
] as const;

export const demoDebugSessions: DebugSessionListResponseDto = {
  sessions: Array.from({ length: 36 }, (_, index) => {
    const failed = index % 6 === 0;
    const warning = index % 5 === 0;
    const agent = demoAgents[index % demoAgents.length] ?? "ResearchBot";

    return {
      id: `demo-session-${index + 1}`,
      runId: `run-${1042 + index}`,
      agentId: `demo-agent-${index % 4}`,
      agentName: agent,
      userId: `demo-user-${index % 8}`,
      status: failed ? "FAILED" : "COMPLETED",
      severity: failed ? "CRITICAL" : warning ? "WARNING" : "INFO",
      startedAt: isoMinutesAgo(8 + index * 7),
      endedAt: isoMinutesAgo(6 + index * 7),
      durationMs: 42000 + index * 1300,
      issueCount: failed ? 2 : warning ? 1 : 0,
      primaryIssue: failed
        ? "TOOL_FAILURE"
        : warning
          ? "HIGH_LATENCY"
          : undefined,
      totalTokens: 4200 + index * 318,
      totalCost: Number((0.041 + index * 0.006).toFixed(3)),
    };
  }),
  page: { hasMore: true, total: 220 },
};

export const demoDebugLogs: DebugEventLogResponseDto = {
  events: Array.from({ length: 50 }, (_, index) => {
    const isTool = index % 3 === 1;
    const isError = index % 11 === 0;
    const agentName = demoAgents[index % 3] ?? "ResearchBot";

    return {
      id: `demo-event-${index + 1}`,
      sessionId: `demo-session-${(index % 12) + 1}`,
      runId: `run-${1042 + (index % 12)}`,
      agentName,
      eventType: isError ? "ERROR" : isTool ? "TOOL_RESULT" : "LLM_CALL",
      label: isError
        ? "Slack API Timeout"
        : isTool
          ? "CRM lookup"
          : "Generate next action",
      phase: isError ? "error" : "single",
      timestamp: isoMinutesAgo(index * 3),
      latency: isError ? 12000 : isTool ? 1840 + index * 20 : 920 + index * 8,
      cost: isTool ? 0 : Number((0.012 + index * 0.001).toFixed(3)),
      model: isTool ? undefined : index % 2 === 0 ? "gpt-5" : "gpt-5-mini",
      toolName: isTool || isError ? "Slack" : undefined,
      severity: isError ? "CRITICAL" : index % 7 === 0 ? "WARNING" : "INFO",
      error: isError ? "504 Gateway Timeout" : undefined,
      inputPreview: isTool
        ? '{"customerId":"cus_demo"}'
        : "Summarize the latest customer context.",
      outputPreview: isError
        ? undefined
        : "The agent selected the next safe action.",
    };
  }),
  page: { hasMore: true, total: 840 },
};

export const demoDebugToolCalls: DebugToolCallListResponseDto = {
  toolCalls: demoDebugLogs.events
    .filter((event) => event.eventType === "TOOL_RESULT" || event.error)
    .slice(0, 30)
    .map((event, index) => ({
      ...event,
      toolName: event.toolName ?? "Slack",
      status: event.error ? "timeout" : index % 8 === 0 ? "failed" : "success",
      retryCount: event.error ? 3 : index % 3,
      sideEffect: index % 5 === 0,
      riskCategory: index % 5 === 0 ? "write" : "read-only",
      argumentsPreview: event.inputPreview,
      resultPreview: event.outputPreview,
    })),
  page: { hasMore: true, total: 410 },
};

export const demoDebugLlmCalls: DebugLlmCallListResponseDto = {
  llmCalls: demoDebugLogs.events
    .filter((event) => event.eventType === "LLM_CALL")
    .slice(0, 30)
    .map((event, index) => ({
      ...event,
      provider: "OpenAI",
      model: event.model ?? "gpt-5",
      promptVersion: `prompt-v${(index % 4) + 1}`,
      temperature: index % 2 === 0 ? 0.2 : 0.7,
      maxTokens: 1200,
      finishReason: "stop",
      totalTokens: 1800 + index * 94,
      requestedToolCall: index % 4 === 0,
      refused: false,
      requestPreview: event.inputPreview,
      responsePreview: event.outputPreview,
    })),
  page: { hasMore: true, total: 620 },
};

export const demoDebugErrors: DebugErrorGroupListResponseDto = {
  errors: [
    {
      fingerprint: "err-slack-timeout",
      title: "Slack API Timeout",
      errorType: "TOOL_FAILURE",
      severity: "CRITICAL",
      occurrenceCount: 31,
      affectedSessions: 24,
      affectedAgents: ["ResearchBot", "SupportBot"],
      firstSeenAt: isoMinutesAgo(360),
      lastSeenAt: isoMinutesAgo(14),
      representativeEventId: "demo-event-1",
      representativeSessionId: "demo-session-1",
      representativeMessage: "Slack API returned 504 Gateway Timeout.",
      relatedTool: "Slack",
      status: "open",
    },
    {
      fingerprint: "err-context-stale",
      title: "Stale context selected",
      errorType: "CONTEXT_FAILURE",
      severity: "WARNING",
      occurrenceCount: 18,
      affectedSessions: 15,
      affectedAgents: ["BillingAgent"],
      firstSeenAt: isoMinutesAgo(280),
      lastSeenAt: isoMinutesAgo(33),
      representativeEventId: "demo-event-9",
      representativeSessionId: "demo-session-7",
      representativeMessage: "Retriever returned outdated pricing context.",
      status: "investigating",
    },
  ],
  page: { hasMore: false, total: 2 },
};

export const demoDebugTimeline: DebugTimelineResponseDto = {
  session: demoDebugSessions.sessions[0]!,
  nodes: [
    {
      id: "demo-trace-1",
      eventId: "demo-trace-1",
      eventType: "USER_INPUT",
      label: "User request",
      phase: "single",
      timestamp: isoMinutesAgo(42),
      depth: 0,
      severity: "INFO",
      summary: "Customer asked for a summary of recent feedback.",
    },
    {
      id: "demo-trace-2",
      eventId: "demo-trace-2",
      eventType: "LLM_CALL",
      label: "Plan research task",
      phase: "single",
      timestamp: isoMinutesAgo(41),
      spanId: "span-plan",
      depth: 1,
      latency: 1820,
      cost: 0.048,
      model: "gpt-5",
      severity: "INFO",
      summary: "Agent selected Slack and CRM context gathering.",
    },
    {
      id: "demo-trace-3",
      eventId: "demo-trace-3",
      eventType: "TOOL_RESULT",
      label: "Slack API Timeout",
      phase: "error",
      timestamp: isoMinutesAgo(39),
      spanId: "span-slack",
      parentSpanId: "span-plan",
      depth: 2,
      latency: 12000,
      toolName: "Slack",
      severity: "CRITICAL",
      summary: "Slack timed out after retries.",
      error: "504 Gateway Timeout",
    },
  ],
  criticalPath: ["demo-trace-1", "demo-trace-2", "demo-trace-3"],
  criticalPathMethod: "MAX_ACCUMULATED_LATENCY",
  highlightedEventId: "demo-trace-3",
};

export const demoDebugRootCause: DebugRootCauseResponseDto = {
  sessionId: "demo-session-1",
  summary: "Slack 도구 timeout이 ResearchBot 실패의 가장 유력한 원인입니다.",
  candidates: [
    {
      id: "candidate-1",
      title: "Slack API Timeout",
      category: "TOOL",
      confidence: 0.91,
      severity: "CRITICAL",
      explanation: "첫 번째 critical 이벤트가 Slack tool result timeout입니다.",
      firstBadEventId: "demo-trace-3",
      evidence: [
        {
          eventId: "demo-trace-3",
          eventType: "TOOL_RESULT",
          label: "Slack API Timeout",
          timestamp: isoMinutesAgo(39),
          summary: "3회 재시도 후 504 timeout이 발생했습니다.",
          weight: 0.91,
        },
      ],
    },
  ],
  primaryCandidateId: "candidate-1",
  confidence: 0.91,
  analysisMethod: "HEURISTIC_V1",
  recommendedActions: [
    {
      title: "Slack read timeout과 backoff 조정",
      description:
        "읽기 tool의 timeout, retry backoff, fallback context를 점검하세요.",
      target: "TOOL",
      priority: "HIGH",
    },
  ],
};

export const demoDebugPatterns: DebugFailurePatternResponseDto = {
  patterns: [
    {
      id: "pattern-slack-timeout",
      name: "Slack timeout after retry",
      severity: "CRITICAL",
      occurrenceCount: 31,
      affectedAgents: ["ResearchBot", "SupportBot"],
      firstSeenAt: isoMinutesAgo(360),
      lastSeenAt: isoMinutesAgo(14),
      signature: {
        eventTypes: ["TOOL_RESULT"],
        labels: ["Slack API Timeout"],
        toolName: "Slack",
      },
      signatureVersion: "SIGNATURE_V1",
      exampleSessionId: "demo-session-1",
    },
  ],
};

export const demoDebugBottlenecks: DebugBottleneckResponseDto = {
  bottlenecks: [
    {
      id: "TOOL:Slack",
      type: "TOOL",
      label: "Slack",
      count: 142,
      avgLatency: 4800,
      p95Latency: 12000,
      totalCost: 0,
      affectedSessions: 61,
      trend: "up",
    },
    {
      id: "LLM:gpt-5",
      type: "LLM",
      label: "gpt-5",
      count: 620,
      avgLatency: 1320,
      p95Latency: 3400,
      totalCost: 42.18,
      affectedSessions: 410,
      trend: "flat",
    },
  ],
};

export const demoDebugLatency: DebugLatencyResponseDto = {
  summary: {
    avgLatency: 1860,
    p50: 920,
    p95: 6200,
    p99: 12000,
    slowEventCount: 44,
  },
  buckets: Array.from({ length: 24 }, (_, index) => ({
    bucket: new Date(now - (23 - index) * 60 * 60 * 1000).toISOString(),
    count: 80 + ((index * 13) % 60),
    p50: 620 + ((index * 31) % 420),
    p95: 2400 + ((index * 311) % 3800),
    p99: 5200 + ((index * 719) % 7800),
  })),
};

export const demoDebugMemory: DebugMemoryResponseDto = {
  accesses: Array.from({ length: 18 }, (_, index) => ({
    eventId: `demo-memory-${index + 1}`,
    sessionId: `demo-session-${(index % 8) + 1}`,
    operation: index % 2 === 0 ? "retrieve" : "write",
    key: `customer-context-${index % 6}`,
    hit: index % 4 !== 0,
    stale: index % 9 === 0,
    timestamp: isoMinutesAgo(index * 11),
    summary:
      index % 4 === 0
        ? "필요한 context를 찾지 못했습니다."
        : "관련 memory snippet을 사용했습니다.",
  })),
  hitCount: 13,
  missCount: 5,
  staleMemoryCount: 2,
  memoryMissCount: 5,
  unknownCount: 0,
};

export const demoDebugReproduce: DebugReproduceResponseDto = {
  replayId: "demo-replay-session-1",
  sourceSessionId: "demo-session-1",
  mode: "DRY_RUN",
  status: "READY",
  reproducible: true,
  deterministicScore: 0.67,
  startedAt: isoMinutesAgo(1),
  completedAt: isoMinutesAgo(1),
  summary: "3개 단계 중 2개는 dry-run 재현이 가능합니다.",
  limitations: ["외부 Slack 응답은 재실행하지 않고 기록된 결과만 비교합니다."],
  steps: [
    {
      sourceEventId: "demo-trace-1",
      eventType: "USER_INPUT",
      label: "User request",
      status: "MATCHED",
      order: 1,
      replayable: true,
    },
    {
      sourceEventId: "demo-trace-2",
      eventType: "LLM_CALL",
      label: "Plan research task",
      status: "MATCHED",
      order: 2,
      replayable: true,
      expectedPreview: "Need Slack and CRM context.",
    },
    {
      sourceEventId: "demo-trace-3",
      eventType: "TOOL_RESULT",
      label: "Slack API Timeout",
      status: "SKIPPED",
      order: 3,
      replayable: false,
      reason: "외부 side effect와 외부 서비스 상태는 재현하지 않습니다.",
    },
  ],
};
