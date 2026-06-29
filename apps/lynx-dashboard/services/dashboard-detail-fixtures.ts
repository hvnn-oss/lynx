import {
  dashboardDemoCost,
  dashboardDemoHome,
  dashboardDemoInsights,
  dashboardDemoStatus,
  dashboardDemoUsage,
} from "./dashboard-demo-fixtures";

export type DashboardDetailKind =
  | "issue"
  | "insight"
  | "agent"
  | "tool"
  | "model"
  | "environment"
  | "cost-anomaly";

export interface DashboardDetailItem {
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
  relatedDebugHref?: string;
}

export function getDemoDashboardDetail(
  kind: DashboardDetailKind,
  rawId: string,
): DashboardDetailItem {
  const id = decodeURIComponent(rawId);

  if (kind === "issue") return getIssueDetail(id);
  if (kind === "insight") return getInsightDetail(id);
  if (kind === "agent") return getAgentDetail(id);
  if (kind === "tool") return getToolDetail(id);
  if (kind === "model") return getModelDetail(id);
  if (kind === "environment") return getEnvironmentDetail(id);
  return getCostAnomalyDetail(id);
}

function getIssueDetail(id: string): DashboardDetailItem {
  const issue =
    dashboardDemoHome.recentIssues.find((item) => item.id === id) ??
    dashboardDemoHome.recentIssues[0]!;

  return {
    id: issue.id,
    title: issue.issueType,
    subtitle: `${issue.agentName} · ${formatDate(issue.lastSeenAt ?? issue.timestamp)}`,
    severity: issue.severity,
    summary:
      "최근 실행에서 반복 감지된 운영 이슈입니다. 관련 Run을 확인해 실패 직전의 LLM 호출, 도구 호출, 정책 판단을 함께 비교하세요.",
    metrics: [
      {
        label: "발생 횟수",
        value: formatNumber(issue.occurrenceCount ?? 1),
        tone: "bad",
      },
      {
        label: "영향 세션",
        value: formatNumber(issue.affectedSessionsCount ?? 1),
        tone: "warning",
      },
      {
        label: "심각도",
        value: issue.severity,
        tone: issue.severity === "CRITICAL" ? "bad" : "warning",
      },
    ],
    sections: [
      {
        title: "관련 실행 신호",
        rows: [
          { label: "에이전트", value: issue.agentName },
          {
            label: "최근 발생",
            value: formatDate(issue.lastSeenAt ?? issue.timestamp),
          },
          { label: "권장 확인", value: "추론 트레이스와 도구 호출 기록" },
        ],
      },
    ],
    relatedDebugHref: "/debug/errors/err-slack-timeout",
  };
}

function getInsightDetail(id: string): DashboardDetailItem {
  const insight =
    dashboardDemoInsights.insights.find((item) => item.id === id) ??
    dashboardDemoInsights.insights[0]!;

  return {
    id: insight.id,
    title: insight.type,
    subtitle: `${insight.cause} · ${formatDate(insight.timestamp)}`,
    severity: insight.severity,
    summary: insight.details.summary,
    metrics: [
      {
        label: "영향 에이전트",
        value: `${insight.affectedAgentsCount}개`,
        tone: "warning",
      },
      {
        label: "심각도",
        value: insight.severity,
        tone: insight.severity === "CRITICAL" ? "bad" : "warning",
      },
      { label: "발생 시각", value: formatDate(insight.timestamp) },
    ],
    sections: [
      {
        title: "분석 요약",
        rows: [
          { label: "원인", value: insight.cause },
          { label: "영향", value: insight.impact },
          { label: "다음 단계", value: "원인 후보와 대표 세션을 확인하세요." },
        ],
      },
    ],
    relatedDebugHref: "/debug/root-cause/demo-session-1",
  };
}

function getAgentDetail(id: string): DashboardDetailItem {
  const health =
    dashboardDemoHome.healthScores.find((item) => item.agentId === id) ??
    dashboardDemoHome.healthScores.find((item) => item.agentName === id) ??
    dashboardDemoHome.healthScores[0]!;
  const usage =
    dashboardDemoUsage.topAgents.find((item) => item.name === health.agentName)
      ?.count ?? 0;
  const cost =
    dashboardDemoCost.costByAgent.find(
      (item) => item.agentName === health.agentName,
    )?.cost ?? 0;

  return {
    id: health.agentId,
    title: health.agentName,
    subtitle: "에이전트 운영 상세",
    severity:
      health.status === "CRITICAL"
        ? "CRITICAL"
        : health.status === "WARNING"
          ? "WARNING"
          : "INFO",
    summary:
      "이 에이전트의 실행량, 건강 점수, 비용, 최근 이슈를 한 화면에서 확인합니다.",
    metrics: [
      {
        label: "건강 점수",
        value: `${health.score}`,
        tone:
          health.score >= 90 ? "good" : health.score >= 75 ? "warning" : "bad",
      },
      { label: "최근 실행", value: formatNumber(usage) },
      { label: "누적 비용", value: formatCurrency(cost) },
    ],
    sections: [
      {
        title: "연결된 디버깅 화면",
        rows: [
          {
            label: "실행 로그",
            value: `/debug/logs?agentId=${health.agentId}`,
          },
          {
            label: "원인 분석",
            value: `/debug/root-cause?agentId=${health.agentId}`,
          },
        ],
      },
    ],
    relatedDebugHref: `/debug/logs?agentId=${health.agentId}`,
  };
}

function getToolDetail(id: string): DashboardDetailItem {
  const tool =
    dashboardDemoStatus.toolStatus.find((item) => item.tool === id) ??
    dashboardDemoStatus.toolStatus[0]!;
  const usage =
    dashboardDemoUsage.toolUsage.find((item) => item.name === tool.tool)
      ?.count ?? 0;

  return {
    id: tool.tool,
    title: tool.tool,
    subtitle: "도구 운영 상세",
    severity:
      tool.successRate < 95
        ? "CRITICAL"
        : tool.successRate < 98
          ? "WARNING"
          : "INFO",
    summary:
      "도구 호출 성공률, 호출량, 관련 실패 패턴을 확인합니다. side effect가 있는 도구는 가드레일 연결도 함께 확인해야 합니다.",
    metrics: [
      {
        label: "성공률",
        value: `${tool.successRate}%`,
        tone:
          tool.successRate >= 98
            ? "good"
            : tool.successRate >= 95
              ? "warning"
              : "bad",
      },
      { label: "호출 수", value: formatNumber(usage) },
      {
        label: "위험 분류",
        value: tool.tool === "Payments API" ? "destructive" : "external",
      },
    ],
    sections: [
      {
        title: "디버깅 포인트",
        rows: [
          {
            label: "대표 실패",
            value: tool.tool === "Slack" ? "API timeout" : "간헐적 실패",
          },
          { label: "권장 화면", value: "도구 호출 기록, 실패 패턴" },
        ],
      },
    ],
    relatedDebugHref: `/debug/tool-calls?tool=${encodeURIComponent(tool.tool)}`,
  };
}

function getModelDetail(id: string): DashboardDetailItem {
  const model =
    dashboardDemoStatus.modelStatus.find((item) => item.model === id) ??
    dashboardDemoStatus.modelStatus[0]!;
  const usage = dashboardDemoUsage.modelUsage.find(
    (item) => item.name === model.model,
  );

  return {
    id: model.model,
    title: model.model,
    subtitle: "LLM 모델 상세",
    severity: model.successRate < 97 ? "WARNING" : "INFO",
    summary:
      "모델 호출 성공률, 토큰 사용량, 지연 시간, 프롬프트 버전과의 연결을 확인합니다.",
    metrics: [
      {
        label: "성공률",
        value: `${model.successRate}%`,
        tone: model.successRate >= 98 ? "good" : "warning",
      },
      { label: "평균 지연", value: `${formatNumber(model.avgLatency)}ms` },
      { label: "토큰", value: formatNumber(usage?.tokens ?? 0) },
    ],
    sections: [
      {
        title: "확인할 항목",
        rows: [
          { label: "프롬프트 버전", value: "prompt-v1 ~ prompt-v4" },
          { label: "권장 화면", value: "LLM 요청/응답, 지연 시간 분포" },
        ],
      },
    ],
    relatedDebugHref: `/debug/llm-io?model=${encodeURIComponent(model.model)}`,
  };
}

function getEnvironmentDetail(id: string): DashboardDetailItem {
  const environment =
    dashboardDemoUsage.environmentUsage.find(
      (item) => item.environment === id,
    ) ?? dashboardDemoUsage.environmentUsage[0]!;

  return {
    id: environment.environment,
    title: environment.environment,
    subtitle: "환경별 실행 상세",
    severity: environment.environment === "production" ? "WARNING" : "INFO",
    summary:
      "환경별 실행량과 최근 오류 신호를 확인합니다. production은 정책 차단과 비용 급증을 우선 확인하세요.",
    metrics: [
      { label: "실행 수", value: formatNumber(environment.runs) },
      { label: "환경", value: environment.environment },
      { label: "권장 범위", value: "최근 24시간" },
    ],
    sections: [
      {
        title: "관련 화면",
        rows: [
          {
            label: "실행 로그",
            value: `/debug/logs?environment=${environment.environment}`,
          },
          {
            label: "병목 구간",
            value: `/debug/bottleneck?environment=${environment.environment}`,
          },
        ],
      },
    ],
    relatedDebugHref: `/debug/logs?environment=${environment.environment}`,
  };
}

function getCostAnomalyDetail(id: string): DashboardDetailItem {
  const anomaly =
    dashboardDemoCost.costAnomalies[Number(id) || 0] ??
    dashboardDemoCost.costAnomalies[0]!;

  return {
    id,
    title: `${anomaly.model} 비용 이상 증가`,
    subtitle: formatDate(anomaly.timestamp),
    severity: "WARNING",
    summary: anomaly.description,
    metrics: [
      {
        label: "증가율",
        value: `${anomaly.percentageIncrease}%`,
        tone: "warning",
      },
      { label: "모델", value: anomaly.model },
      { label: "발생 시각", value: formatDate(anomaly.timestamp) },
    ],
    sections: [
      {
        title: "확인할 항목",
        rows: [
          { label: "원인 후보", value: "긴 context, retry, 모델 fallback" },
          { label: "권장 화면", value: "LLM 요청/응답, 병목 구간 분석" },
        ],
      },
    ],
    relatedDebugHref: `/debug/llm-io?model=${encodeURIComponent(anomaly.model)}`,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
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
