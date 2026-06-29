import type {
  DebugBottleneckItemDto,
  DebugErrorGroupDto,
  DebugEventLogItemDto,
  DebugFailurePatternDto,
  DebugLlmCallItemDto,
  DebugMemoryAccessDto,
  DebugToolCallItemDto,
} from "@repo/dto";
import {
  demoDebugBottlenecks,
  demoDebugErrors,
  demoDebugLatency,
  demoDebugLlmCalls,
  demoDebugLogs,
  demoDebugMemory,
  demoDebugPatterns,
  demoDebugReproduce,
  demoDebugRootCause,
  demoDebugTimeline,
  demoDebugToolCalls,
} from "./debug-demo-fixtures";

export type DebugDetailKind =
  | "event"
  | "trace"
  | "tool-call"
  | "llm-call"
  | "error"
  | "root-cause"
  | "failure-pattern"
  | "reproduce"
  | "bottleneck"
  | "latency"
  | "memory";

export interface DebugDetailItem {
  id: string;
  title: string;
  subtitle: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  summary: string;
  metrics: Array<{
    label: string;
    value: string;
    tone?: "neutral" | "good" | "warning" | "bad";
  }>;
  sections: Array<{
    title: string;
    rows: Array<{ label: string; value: string }>;
  }>;
}

export function getDemoDebugDetail(
  kind: DebugDetailKind,
  rawId: string,
): DebugDetailItem {
  const id = decodeURIComponent(rawId);

  if (kind === "event") return eventDetail(findEvent(id));
  if (kind === "trace") return traceDetail(id);
  if (kind === "tool-call") return toolCallDetail(findToolCall(id));
  if (kind === "llm-call") return llmCallDetail(findLlmCall(id));
  if (kind === "error") return errorDetail(findError(id));
  if (kind === "root-cause") return rootCauseDetail(id);
  if (kind === "failure-pattern") return patternDetail(findPattern(id));
  if (kind === "reproduce") return reproduceDetail(id);
  if (kind === "bottleneck") return bottleneckDetail(findBottleneck(id));
  if (kind === "latency") return latencyDetail(id);
  return memoryDetail(findMemory(id));
}

function findEvent(id: string): DebugEventLogItemDto {
  return (
    demoDebugLogs.events.find((item) => item.id === id) ??
    demoDebugLogs.events[0]!
  );
}

function findToolCall(id: string): DebugToolCallItemDto {
  return (
    demoDebugToolCalls.toolCalls.find((item) => item.id === id) ??
    demoDebugToolCalls.toolCalls[0]!
  );
}

function findLlmCall(id: string): DebugLlmCallItemDto {
  return (
    demoDebugLlmCalls.llmCalls.find((item) => item.id === id) ??
    demoDebugLlmCalls.llmCalls[0]!
  );
}

function findError(id: string): DebugErrorGroupDto {
  return (
    demoDebugErrors.errors.find((item) => item.fingerprint === id) ??
    demoDebugErrors.errors[0]!
  );
}

function findPattern(id: string): DebugFailurePatternDto {
  return (
    demoDebugPatterns.patterns.find((item) => item.id === id) ??
    demoDebugPatterns.patterns[0]!
  );
}

function findBottleneck(id: string): DebugBottleneckItemDto {
  return (
    demoDebugBottlenecks.bottlenecks.find((item) => item.id === id) ??
    demoDebugBottlenecks.bottlenecks[0]!
  );
}

function findMemory(id: string): DebugMemoryAccessDto {
  return (
    demoDebugMemory.accesses.find((item) => item.eventId === id) ??
    demoDebugMemory.accesses[0]!
  );
}

function eventDetail(event: DebugEventLogItemDto): DebugDetailItem {
  return {
    id: event.id,
    title: event.label,
    subtitle: `${event.agentName} · ${event.eventType}`,
    severity: event.severity,
    summary:
      event.error ??
      event.outputPreview ??
      event.inputPreview ??
      "기록된 이벤트 상세입니다.",
    metrics: [
      {
        label: "지연",
        value: formatMs(event.latency),
        tone: event.latency && event.latency > 3000 ? "warning" : "neutral",
      },
      { label: "비용", value: formatCost(event.cost) },
      {
        label: "심각도",
        value: event.severity ?? "INFO",
        tone:
          event.severity === "CRITICAL"
            ? "bad"
            : event.severity === "WARNING"
              ? "warning"
              : "neutral",
      },
    ],
    sections: [
      {
        title: "이벤트 정보",
        rows: [
          { label: "Run ID", value: event.runId },
          { label: "Session ID", value: event.sessionId },
          { label: "시간", value: formatDate(event.timestamp) },
          { label: "입력", value: event.inputPreview ?? "-" },
          { label: "출력", value: event.outputPreview ?? "-" },
        ],
      },
    ],
  };
}

function traceDetail(sessionId: string): DebugDetailItem {
  return {
    id: sessionId,
    title: demoDebugTimeline.session.runId,
    subtitle: `${demoDebugTimeline.session.agentName} · ${demoDebugTimeline.nodes.length} steps`,
    severity: demoDebugTimeline.session.severity,
    summary:
      "사용자 입력부터 최종 실패 지점까지의 실행 흐름입니다. critical path를 따라 지연과 오류가 누적된 구간을 확인하세요.",
    metrics: [
      { label: "단계 수", value: `${demoDebugTimeline.nodes.length}` },
      {
        label: "Critical path",
        value: `${demoDebugTimeline.criticalPath.length}`,
      },
      {
        label: "총 비용",
        value: formatCost(demoDebugTimeline.session.totalCost),
      },
    ],
    sections: [
      {
        title: "주요 단계",
        rows: demoDebugTimeline.nodes.map((node) => ({
          label: node.label,
          value: `${node.eventType} · ${formatMs(node.latency)} · ${node.summary ?? "-"}`,
        })),
      },
    ],
  };
}

function toolCallDetail(tool: DebugToolCallItemDto): DebugDetailItem {
  return {
    id: tool.id,
    title: tool.toolName,
    subtitle: `${tool.agentName} · ${tool.status}`,
    severity: tool.severity,
    summary:
      tool.error ??
      tool.resultPreview ??
      "도구 호출 결과와 side effect 위험도를 확인합니다.",
    metrics: [
      {
        label: "상태",
        value: tool.status,
        tone: tool.status === "success" ? "good" : "bad",
      },
      { label: "재시도", value: `${tool.retryCount}` },
      {
        label: "위험도",
        value: tool.riskCategory,
        tone:
          tool.riskCategory === "destructive"
            ? "bad"
            : tool.riskCategory === "write"
              ? "warning"
              : "neutral",
      },
    ],
    sections: [
      {
        title: "호출 입출력",
        rows: [
          { label: "Arguments", value: tool.argumentsPreview ?? "-" },
          { label: "Result", value: tool.resultPreview ?? "-" },
          { label: "Side effect", value: tool.sideEffect ? "있음" : "없음" },
        ],
      },
    ],
  };
}

function llmCallDetail(call: DebugLlmCallItemDto): DebugDetailItem {
  return {
    id: call.id,
    title: call.model,
    subtitle: `${call.agentName} · ${call.provider ?? "unknown provider"}`,
    severity: call.severity,
    summary:
      call.responsePreview ?? "LLM 요청과 응답, 토큰, 비용을 확인합니다.",
    metrics: [
      { label: "토큰", value: formatNumber(call.totalTokens) },
      { label: "지연", value: formatMs(call.latency) },
      { label: "비용", value: formatCost(call.cost) },
    ],
    sections: [
      {
        title: "모델 호출 정보",
        rows: [
          { label: "프롬프트 버전", value: call.promptVersion ?? "-" },
          { label: "Temperature", value: call.temperature?.toString() ?? "-" },
          { label: "Finish reason", value: call.finishReason ?? "-" },
          { label: "Request", value: call.requestPreview ?? "-" },
          { label: "Response", value: call.responsePreview ?? "-" },
        ],
      },
    ],
  };
}

function errorDetail(error: DebugErrorGroupDto): DebugDetailItem {
  return {
    id: error.fingerprint,
    title: error.title,
    subtitle: `${error.errorType} · ${error.status}`,
    severity: error.severity,
    summary:
      error.representativeMessage ?? "같은 원인으로 묶인 에러 그룹입니다.",
    metrics: [
      {
        label: "발생 횟수",
        value: formatNumber(error.occurrenceCount),
        tone: "bad",
      },
      {
        label: "영향 세션",
        value: formatNumber(error.affectedSessions),
        tone: "warning",
      },
      { label: "최근 발생", value: formatDate(error.lastSeenAt) },
    ],
    sections: [
      {
        title: "그룹 정보",
        rows: [
          { label: "Fingerprint", value: error.fingerprint },
          { label: "영향 에이전트", value: error.affectedAgents.join(", ") },
          { label: "대표 이벤트", value: error.representativeEventId },
          { label: "관련 도구", value: error.relatedTool ?? "-" },
          { label: "관련 모델", value: error.relatedModel ?? "-" },
        ],
      },
    ],
  };
}

function rootCauseDetail(sessionId: string): DebugDetailItem {
  const candidate = demoDebugRootCause.candidates[0];
  return {
    id: sessionId,
    title: "원인 후보 분석",
    subtitle: demoDebugRootCause.sessionId,
    severity: candidate?.severity,
    summary: demoDebugRootCause.summary,
    metrics: [
      {
        label: "신뢰도",
        value: demoDebugRootCause.confidence
          ? `${Math.round(demoDebugRootCause.confidence * 100)}%`
          : "-",
      },
      { label: "후보 수", value: `${demoDebugRootCause.candidates.length}` },
      { label: "분석 방식", value: demoDebugRootCause.analysisMethod ?? "-" },
    ],
    sections: [
      {
        title: "추천 조치",
        rows: demoDebugRootCause.recommendedActions.map((action) => ({
          label: action.title,
          value: `${action.priority} · ${action.description}`,
        })),
      },
    ],
  };
}

function patternDetail(pattern: DebugFailurePatternDto): DebugDetailItem {
  return {
    id: pattern.id,
    title: pattern.name,
    subtitle: `${pattern.occurrenceCount} occurrences`,
    severity: pattern.severity,
    summary:
      "반복 감지된 실패 패턴입니다. 대표 세션과 signature를 기준으로 같은 문제를 추적하세요.",
    metrics: [
      {
        label: "발생 횟수",
        value: formatNumber(pattern.occurrenceCount),
        tone: "warning",
      },
      { label: "영향 에이전트", value: `${pattern.affectedAgents.length}개` },
      { label: "최근 발생", value: formatDate(pattern.lastSeenAt) },
    ],
    sections: [
      {
        title: "Signature",
        rows: [
          {
            label: "Event types",
            value: pattern.signature.eventTypes.join(", "),
          },
          { label: "Labels", value: pattern.signature.labels.join(", ") },
          { label: "Tool", value: pattern.signature.toolName ?? "-" },
          { label: "대표 세션", value: pattern.exampleSessionId },
        ],
      },
    ],
  };
}

function reproduceDetail(sessionId: string): DebugDetailItem {
  return {
    id: sessionId,
    title: "재현 계획",
    subtitle: demoDebugReproduce.replayId,
    severity: demoDebugReproduce.status === "FAILED" ? "CRITICAL" : "INFO",
    summary:
      demoDebugReproduce.summary ??
      "재현 가능한 단계와 제한 사항을 확인합니다.",
    metrics: [
      { label: "상태", value: demoDebugReproduce.status },
      {
        label: "결정성",
        value: demoDebugReproduce.deterministicScore
          ? `${Math.round(demoDebugReproduce.deterministicScore * 100)}%`
          : "-",
      },
      { label: "단계 수", value: `${demoDebugReproduce.steps.length}` },
    ],
    sections: [
      {
        title: "재현 단계",
        rows: demoDebugReproduce.steps.map((step) => ({
          label: step.label,
          value: `${step.status} · ${step.reason ?? step.expectedPreview ?? "-"}`,
        })),
      },
    ],
  };
}

function bottleneckDetail(item: DebugBottleneckItemDto): DebugDetailItem {
  return {
    id: item.id,
    title: item.label,
    subtitle: `${item.type} bottleneck`,
    severity:
      item.p95Latency >= 10000
        ? "CRITICAL"
        : item.p95Latency >= 3000
          ? "WARNING"
          : "INFO",
    summary:
      "critical path에서 많은 시간을 차지하는 구간입니다. p95 지연과 영향 세션을 우선 확인하세요.",
    metrics: [
      { label: "p95", value: formatMs(item.p95Latency), tone: "warning" },
      { label: "평균", value: formatMs(item.avgLatency) },
      { label: "영향 세션", value: formatNumber(item.affectedSessions) },
    ],
    sections: [
      {
        title: "집계 정보",
        rows: [
          { label: "호출 수", value: formatNumber(item.count) },
          { label: "총 비용", value: formatCost(item.totalCost) },
          { label: "추세", value: item.trend },
        ],
      },
    ],
  };
}

function latencyDetail(id: string): DebugDetailItem {
  const bucket =
    demoDebugLatency.buckets.find(
      (item) => encodeURIComponent(item.bucket) === id || item.bucket === id,
    ) ?? demoDebugLatency.buckets[0]!;

  return {
    id,
    title: "지연 시간 버킷",
    subtitle: formatDate(bucket.bucket),
    severity: bucket.p95 >= 6000 ? "WARNING" : "INFO",
    summary: "해당 시간대의 latency percentile과 이벤트 수를 확인합니다.",
    metrics: [
      { label: "p50", value: formatMs(bucket.p50) },
      { label: "p95", value: formatMs(bucket.p95), tone: "warning" },
      { label: "p99", value: formatMs(bucket.p99), tone: "bad" },
    ],
    sections: [
      {
        title: "버킷 정보",
        rows: [
          { label: "이벤트 수", value: formatNumber(bucket.count) },
          { label: "시간", value: formatDate(bucket.bucket) },
        ],
      },
    ],
  };
}

function memoryDetail(item: DebugMemoryAccessDto): DebugDetailItem {
  return {
    id: item.eventId,
    title: item.key ?? item.operation,
    subtitle: `${item.operation} · ${item.sessionId}`,
    severity: item.stale ? "WARNING" : item.hit === false ? "WARNING" : "INFO",
    summary: item.summary ?? "메모리 접근 상세입니다.",
    metrics: [
      {
        label: "Hit",
        value: item.hit === undefined ? "-" : item.hit ? "Y" : "N",
      },
      {
        label: "Stale",
        value: item.stale === undefined ? "-" : item.stale ? "Y" : "N",
        tone: item.stale ? "warning" : "neutral",
      },
      { label: "시간", value: formatDate(item.timestamp) },
    ],
    sections: [
      {
        title: "메모리 정보",
        rows: [
          { label: "Event ID", value: item.eventId },
          { label: "Session ID", value: item.sessionId },
          { label: "Key", value: item.key ?? "-" },
        ],
      },
    ],
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatMs(value?: number) {
  return typeof value === "number"
    ? `${Math.round(value).toLocaleString("ko-KR")}ms`
    : "-";
}

function formatCost(value?: number) {
  return typeof value === "number" ? `$${value.toFixed(3)}` : "-";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
