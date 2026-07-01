"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ServerDataTable } from "@repo/ui/components/debug/server-data-table";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight, Filter, GitBranch, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import type {
  DebugBottleneckItemDto,
  DebugErrorGroupDto,
  DebugEventLogItemDto,
  DebugFailurePatternDto,
  DebugLatencyBucketDto,
  DebugLlmCallItemDto,
  DebugMemoryAccessDto,
  DebugReproduceResponseDto,
  DebugReproduceStepDto,
  DebugRootCauseCandidateDto,
  DebugSeverity,
  DebugSessionStatus,
  DebugTimelineNodeDto,
  DebugToolCallItemDto,
} from "@repo/dto";
import {
  useDebugBottlenecksQuery,
  useDebugErrorsQuery,
  useDebugLatencyQuery,
  useDebugLlmCallsQuery,
  useDebugLogsQuery,
  useDebugMemoryQuery,
  useDebugPatternsQuery,
  useDebugRootCauseQuery,
  useDebugSessionsQuery,
  useDebugTimelineQuery,
  useDebugToolCallsQuery,
  useDebugReproduceMutation,
} from "@/hooks/queries/debug";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import {
  DebugEmptyState,
  DebugFilterBar,
  DebugSummaryCard,
  IssueBadge,
} from "./debug-common";
import { RelatedInvestigationPanel } from "@/components/investigation/related-investigation";
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
  demoDebugSessions,
  demoDebugTimeline,
  demoDebugToolCalls,
} from "@/services/debug-demo-fixtures";

export type DebugPageKind =
  | "logs"
  | "trace"
  | "tool-calls"
  | "llm-io"
  | "errors"
  | "root-cause"
  | "failure-patterns"
  | "reproduce"
  | "bottleneck"
  | "latency"
  | "memory";

export function DebugPageView({ kind }: { kind: DebugPageKind }) {
  const t = useTranslations("debug");
  const searchParams = useSearchParams();
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const query = useMemo(
    () => ({
      workspaceId,
      limit: 25,
      ...debugQueryFromSearchParams(searchParams),
    }),
    [searchParams, workspaceId],
  );
  const sessionsQuery = useDebugSessionsQuery(query);
  const sessions = runtimeConfig.demoMode
    ? demoDebugSessions
    : sessionsQuery.data;
  const selectedSessionId =
    searchParams.get("sessionId") ?? sessions?.sessions[0]?.id;

  if (!workspaceId && !runtimeConfig.demoMode) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("empty.workspace")}
        </p>
      </DashboardPanel>
    );
  }

  return (
    <div className="space-y-6">
      <DebugPurposePanel kind={kind} />
      <RelatedInvestigationPanel
        description="대시보드, 세션, 에이전트에서 넘어온 조사 맥락을 유지합니다. 필요한 경우 같은 필터로 다른 분석 화면을 바로 열 수 있습니다."
        items={createDebugRelatedItems(kind, query)}
        actions={createDebugRelatedActions(kind, query)}
      />
      {kind === "logs" ? (
        <LogsTable query={query} />
      ) : kind === "trace" ? (
        <TraceView sessionId={selectedSessionId} workspaceId={workspaceId} />
      ) : kind === "tool-calls" ? (
        <ToolCallsTable query={query} />
      ) : kind === "llm-io" ? (
        <LlmCallsTable query={query} />
      ) : kind === "errors" ? (
        <ErrorsTable query={query} />
      ) : kind === "root-cause" ? (
        <RootCauseView
          sessionId={selectedSessionId}
          workspaceId={workspaceId}
        />
      ) : kind === "failure-patterns" ? (
        <FailurePatternsView query={query} />
      ) : kind === "reproduce" ? (
        <ReproduceView sessionId={selectedSessionId} workspaceId={workspaceId} />
      ) : kind === "bottleneck" ? (
        <BottleneckView query={query} />
      ) : kind === "latency" ? (
        <LatencyView query={query} />
      ) : (
        <MemoryView sessionId={selectedSessionId} workspaceId={workspaceId} />
      )}
    </div>
  );
}

function debugQueryFromSearchParams(searchParams: URLSearchParams) {
  return {
    agentId: searchParams.get("agentId") ?? undefined,
    sessionId: searchParams.get("sessionId") ?? undefined,
    runId: searchParams.get("runId") ?? undefined,
    eventType: searchParams.get("eventType") ?? undefined,
    severity: normalizeDebugSeverity(searchParams.get("severity")),
    status: normalizeDebugStatus(searchParams.get("status")),
    label:
      searchParams.get("toolName") ??
      searchParams.get("tool") ??
      searchParams.get("label") ??
      undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    groupBy: searchParams.get("groupBy") ?? undefined,
  };
}

function normalizeDebugSeverity(value: string | null): DebugSeverity | undefined {
  if (value === "INFO" || value === "WARNING" || value === "CRITICAL") {
    return value;
  }
  return undefined;
}

function normalizeDebugStatus(
  value: string | null,
): DebugSessionStatus | undefined {
  if (
    value === "RUNNING" ||
    value === "COMPLETED" ||
    value === "FAILED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return undefined;
}

function createDebugRelatedItems(
  kind: DebugPageKind,
  query: ReturnType<typeof debugQueryFromSearchParams> & {
    workspaceId?: string;
    limit: number;
  },
) {
  return [
    {
      label: "출발 지점",
      value: debugSourceLabel(kind),
      href: "/dashboard",
    },
    {
      label: "세션",
      value: query.sessionId ?? "필터 없음",
      href: query.sessionId ? `/dashboard/session/${query.sessionId}` : "/dashboard/session/overview",
    },
    {
      label: "에이전트",
      value: query.agentId ?? "필터 없음",
      href: query.agentId ? `/agents/${query.agentId}` : "/agents",
    },
    {
      label: "필터",
      value:
        query.label ??
        query.eventType ??
        query.status ??
        query.severity ??
        "전체",
    },
  ];
}

function createDebugRelatedActions(
  kind: DebugPageKind,
  query: ReturnType<typeof debugQueryFromSearchParams> & {
    workspaceId?: string;
    limit: number;
  },
) {
  const params = toInvestigationSearch(query);
  const sessionId = query.sessionId ?? "demo-session-1";

  return [
    { label: "관련 세션", href: `/dashboard/session/overview${params}` },
    { label: "추론 트레이스", href: `/debug/trace${params}` },
    { label: "실행 로그", href: `/debug/logs${params}` },
    kind === "reproduce"
      ? { label: "에러 리포트", href: `/debug/errors${params}` }
      : { label: "재현 환경", href: `/debug/reproduce/${sessionId}${params}` },
  ];
}

function toInvestigationSearch(
  query: ReturnType<typeof debugQueryFromSearchParams> & {
    workspaceId?: string;
    limit: number;
  },
) {
  const params = new URLSearchParams();
  [
    "agentId",
    "sessionId",
    "runId",
    "eventType",
    "severity",
    "status",
    "label",
    "from",
    "to",
  ].forEach((key) => {
    const value = query[key as keyof typeof query];
    if (typeof value === "string" && value.length > 0) {
      params.set(key === "label" ? "toolName" : key, value);
    }
  });
  const value = params.toString();
  return value ? `?${value}` : "";
}

function debugSourceLabel(kind: DebugPageKind) {
  if (kind === "logs") return "이상 이벤트 탐색";
  if (kind === "trace") return "세션 타임라인";
  if (kind === "tool-calls") return "도구/SaaS 문제";
  if (kind === "llm-io") return "비용/토큰 분석";
  if (kind === "errors") return "반복 에러 그룹";
  if (kind === "root-cause") return "원인 후보 분석";
  if (kind === "failure-patterns") return "반복 실패 패턴";
  if (kind === "reproduce") return "재현 검증";
  if (kind === "bottleneck") return "병목 분석";
  if (kind === "latency") return "성능 추세";
  return "메모리/context 진단";
}

function DebugPurposePanel({ kind }: { kind: DebugPageKind }) {
  const t = useTranslations("debug");
  const items = t.raw(`guide.${kind}.items`) as string[];
  const filters = t.raw(`guide.${kind}.filters`) as string[];

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <DashboardPanel>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("guide.common.toolRole")}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-normal">
              {t(`guide.${kind}.role`)}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t(`guide.${kind}.description`)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">{t("guide.common.backToOverview")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/debug/trace/demo-session-1">
                <GitBranch className="size-3.5" />
                {t("guide.common.exampleTrace")}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-md border border-border/40 bg-background/50 p-3"
            >
              <p className="text-xs font-medium leading-5 text-muted-foreground">
                {item}
              </p>
            </div>
          ))}
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{t("guide.common.searchBy")}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(`guide.${kind}.search`)}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{t("guide.common.filters")}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <IssueBadge key={filter} label={filter} tone="neutral" />
          ))}
        </div>
      </DashboardPanel>
    </section>
  );
}

function DebugInsightPanel({
  title,
  description,
  badges,
  href,
}: {
  title: string;
  description: string;
  badges: Array<{
    label: string;
    tone?: "neutral" | "good" | "warning" | "bad";
  }>;
  href?: string;
}) {
  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <IssueBadge
                key={`${badge.label}-${badge.tone}`}
                label={badge.label}
                tone={badge.tone}
              />
            ))}
          </div>
          <p className="font-semibold tracking-normal">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {href ? (
          <Button asChild size="sm" variant="outline">
            <Link href={href}>
              확인하기
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
    </DashboardPanel>
  );
}

function LogsTable({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const logsQuery = useDebugLogsQuery(query);
  const data = runtimeConfig.demoMode ? demoDebugLogs : logsQuery.data;
  const events = data?.events ?? [];
  const errorCount = events.filter(isCriticalEvent).length;
  const guardrailCount = events.filter((event) =>
    event.eventType.includes("GUARDRAIL"),
  ).length;
  const slowCount = events.filter(
    (event) => (event.latency ?? 0) >= 3000,
  ).length;
  const mostCommonType = getMostCommon(events.map((event) => event.eventType));
  const firstIssue = events.find(
    (event) => isCriticalEvent(event) || (event.latency ?? 0) >= 3000,
  );
  const columns = useMemo<ColumnDef<DebugEventLogItemDto>[]>(
    () => [
      textColumn("timestamp", t("columns.time"), formatTime),
      textColumn("eventType", t("columns.eventType")),
      badgeColumn("severity", t("columns.severity")),
      textColumn("label", t("columns.label")),
      textColumn("agentName", t("columns.agent")),
      valueColumn("latency", t("columns.latency"), formatMs),
      textColumn("sessionId", "sessionId"),
      textColumn("runId", t("columns.runId")),
      detailColumn(t("columns.detail"), (item) => `/debug/logs/${item.id}`),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="SDK를 연결하고 테스트 이벤트를 보내면 로그, trace, payload 요약을 이곳에서 확인할 수 있습니다."
      emptyText={t("empty.logs")}
      filters={{
        basic: ["기간", "이벤트 타입", "상태", "에이전트", "환경"],
        advanced: [
          "traceId",
          "sessionId",
          "userId",
          "tool name",
          "error message",
          "SDK 버전",
        ],
      }}
      hasData={events.length > 0}
      insight={{
        title: firstIssue?.label ?? "현재 눈에 띄는 이상 이벤트가 없습니다",
        description: firstIssue
          ? "이 이벤트를 시작점으로 관련 trace와 session을 따라가면 원인을 빠르게 좁힐 수 있습니다."
          : "필터를 조정하거나 traceId/sessionId로 검색해 특정 실행의 이벤트 흐름을 확인하세요.",
        badges: [
          { label: firstIssue?.eventType ?? "전체 로그", tone: "neutral" },
          {
            label: firstIssue?.severity ?? "INFO",
            tone: firstIssue?.severity === "CRITICAL" ? "bad" : "neutral",
          },
        ],
        href: firstIssue ? `/debug/logs/${firstIssue.id}` : undefined,
      }}
      summary={[
        {
          label: "최근 에러 이벤트",
          value: `${errorCount}`,
          tone: errorCount > 0 ? "bad" : "good",
        },
        {
          label: "가드레일 이벤트",
          value: `${guardrailCount}`,
          tone: guardrailCount > 0 ? "warning" : "neutral",
        },
        {
          label: "느린 이벤트",
          value: `${slowCount}`,
          tone: slowCount > 0 ? "warning" : "good",
        },
        { label: "최다 이벤트 타입", value: mostCommonType },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={events}
        emptyText={t("empty.logs")}
        footer={summaryFooter(t, data?.page.total, events.length)}
        hasNextPage={data?.page.hasMore}
        isLoading={logsQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function TraceView({
  sessionId,
  workspaceId,
}: {
  sessionId?: string;
  workspaceId?: string;
}) {
  const t = useTranslations("debug");
  const timelineQuery = useDebugTimelineQuery(sessionId, { workspaceId });
  const data = runtimeConfig.demoMode ? demoDebugTimeline : timelineQuery.data;
  const nodes = data?.nodes ?? [];
  const failedNode = nodes.find(
    (node) => node.severity === "CRITICAL" || node.error,
  );
  const criticalPathNodes = nodes.filter((node) =>
    data?.criticalPath.includes(node.id),
  );
  const totalLatency = nodes.reduce(
    (sum, node) => sum + (node.latency ?? 0),
    0,
  );

  return (
    <AnalysisLayout
      emptyDescription="traceId나 sessionId로 검색하면 span tree, critical path, 실패 span을 함께 볼 수 있습니다."
      emptyText={t("empty.trace")}
      filters={{
        basic: ["traceId", "sessionId", "실패 span", "느린 span"],
        advanced: ["spanId", "parentSpanId", "retry", "LLM", "Tool", "Memory"],
      }}
      hasData={nodes.length > 0}
      insight={{
        title:
          failedNode?.label ??
          "critical path를 기준으로 실행 구조를 확인하세요",
        description: failedNode
          ? "실패한 span을 기준으로 부모 span과 이전 LLM/Tool 호출을 따라가면 실제 원인 후보가 좁혀집니다."
          : "단순 시간순 로그가 아니라 parent-child 구조와 누적 지연을 함께 확인하는 화면입니다.",
        badges: [
          {
            label: data?.criticalPathMethod ?? "critical path",
            tone: "warning",
          },
          { label: data?.session?.runId ?? "run", tone: "neutral" },
        ],
        href: failedNode ? `/debug/logs/${failedNode.eventId}` : undefined,
      }}
      summary={[
        { label: "span 수", value: `${nodes.length}` },
        { label: "critical path", value: `${criticalPathNodes.length}` },
        {
          label: "총 latency",
          value: formatMs(totalLatency),
          tone: totalLatency >= 10000 ? "warning" : "neutral",
        },
        {
          label: "실패 span",
          value: failedNode ? failedNode.label : "-",
          tone: failedNode ? "bad" : "good",
        },
      ]}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashboardPanel>
          <p className="text-sm font-semibold">Span tree</p>
          <div className="mt-4 space-y-2">
            {nodes.map((node) => (
              <TraceNodeRow
                key={node.id}
                node={node}
                isCritical={data?.criticalPath.includes(node.id) ?? false}
              />
            ))}
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <p className="text-sm font-semibold">선택 전 확인할 것</p>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>1. 가장 깊은 실패 span의 부모를 확인합니다.</p>
            <p>2. retry 이전의 첫 실패 이벤트를 찾습니다.</p>
            <p>3. 관련 세션 상세에서 입력, 출력, Tool 인자를 확인합니다.</p>
          </div>
          {data?.session ? (
            <Button asChild className="mt-5" size="sm" variant="outline">
              <Link href={`/debug/trace/${data.session.id}`}>
                관련 trace 열기
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : null}
        </DashboardPanel>
      </div>
    </AnalysisLayout>
  );
}

function ToolCallsTable({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const toolCallsQuery = useDebugToolCallsQuery(query);
  const data = runtimeConfig.demoMode
    ? demoDebugToolCalls
    : toolCallsQuery.data;
  const toolCalls = data?.toolCalls ?? [];
  const failedCount = toolCalls.filter(
    (item) => item.status !== "success",
  ).length;
  const timeoutCount = toolCalls.filter(
    (item) => item.status === "timeout",
  ).length;
  const riskiest =
    toolCalls.find((item) => item.riskCategory === "destructive") ??
    toolCalls[0];
  const columns = useMemo<ColumnDef<DebugToolCallItemDto>[]>(
    () => [
      textColumn("toolName", t("columns.tool")),
      textColumn("agentName", t("columns.agent")),
      badgeColumn("status", t("columns.status")),
      badgeColumn("riskCategory", t("columns.risk")),
      valueColumn("retryCount", t("columns.retry")),
      valueColumn("latency", t("columns.latency"), formatMs),
      textColumn("argumentsPreview", t("columns.arguments")),
      textColumn("error", t("columns.error")),
      detailColumn(
        t("columns.detail"),
        (item) => `/debug/tool-calls/${item.id}`,
      ),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="Tool 이벤트가 수집되면 실패율, side effect, timeout을 tool name 기준으로 묶어 보여줍니다."
      emptyText={t("empty.toolCalls")}
      filters={{
        basic: ["tool name", "status", "risk", "기간"],
        advanced: [
          "retry count",
          "side effect",
          "sessionId",
          "traceId",
          "error message",
        ],
      }}
      hasData={toolCalls.length > 0}
      insight={{
        title: `${getMostCommon(toolCalls.map((item) => item.toolName))} 호출을 먼저 확인하세요`,
        description:
          "실패율, timeout, retry, side effect 여부를 함께 보면 어떤 도구가 문제를 만들고 있는지 빠르게 좁힐 수 있습니다.",
        badges: [
          { label: "tool ranking", tone: "neutral" },
          { label: "side effect", tone: "warning" },
          {
            label: `${timeoutCount} timeout`,
            tone: timeoutCount > 0 ? "bad" : "good",
          },
        ],
        href: riskiest ? `/debug/tool-calls/${riskiest.id}` : undefined,
      }}
      summary={[
        { label: "총 Tool call", value: `${toolCalls.length}` },
        {
          label: "실패율",
          value: `${formatRatio(failedCount, toolCalls.length)}%`,
          tone: failedCount > 0 ? "bad" : "good",
        },
        {
          label: "평균 latency",
          value: formatMs(
            averageNumbers(toolCalls.map((item) => item.latency)),
          ),
          tone: "warning",
        },
        {
          label: "timeout",
          value: `${timeoutCount}`,
          tone: timeoutCount > 0 ? "bad" : "good",
        },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={toolCalls}
        emptyText={t("empty.toolCalls")}
        footer={summaryFooter(t, data?.page.total, toolCalls.length)}
        hasNextPage={data?.page.hasMore}
        isLoading={toolCallsQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function LlmCallsTable({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const llmCallsQuery = useDebugLlmCallsQuery(query);
  const data = runtimeConfig.demoMode ? demoDebugLlmCalls : llmCallsQuery.data;
  const llmCalls = data?.llmCalls ?? [];
  const totalCost = llmCalls.reduce(
    (sum, item) => sum + Number(item.cost ?? 0),
    0,
  );
  const refusedCount = llmCalls.filter(
    (item) => item.refused || item.error,
  ).length;
  const columns = useMemo<ColumnDef<DebugLlmCallItemDto>[]>(
    () => [
      textColumn("model", t("columns.model")),
      textColumn("provider", t("columns.provider")),
      textColumn("agentName", t("columns.agent")),
      sessionLinkColumn(t("columns.session")),
      textColumn("runId", t("columns.runId")),
      textColumn("promptVersion", t("columns.promptVersion")),
      valueColumn("totalTokens", t("columns.tokens"), (value) =>
        formatNumber(Number(value ?? 0)),
      ),
      valueColumn("latency", t("columns.latency"), formatMs),
      valueColumn("cost", t("columns.cost"), formatCost),
      badgeColumn("finishReason", t("columns.finishReason")),
      detailColumn(t("columns.detail"), (item) => `/debug/llm-io/${item.id}`),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="LLM 호출이 수집되면 모델, prompt version, token, cost, latency를 기준으로 품질과 비용을 확인할 수 있습니다."
      emptyText={t("empty.llmIo")}
      filters={{
        basic: ["provider", "model", "prompt version", "기간"],
        advanced: [
          "finish reason",
          "tool call",
          "refusal",
          "error",
          "sessionId",
          "traceId",
        ],
      }}
      hasData={llmCalls.length > 0}
      insight={{
        title: `${getMostCommon(llmCalls.map((item) => item.model))} 모델 호출을 먼저 확인하세요`,
        description:
          "긴 prompt/response는 접어두고 token, cost, latency, finish reason, tool call 여부를 먼저 확인합니다.",
        badges: [
          { label: "prompt version", tone: "neutral" },
          { label: "cost", tone: totalCost > 1 ? "warning" : "neutral" },
          {
            label: `${refusedCount} refusal/error`,
            tone: refusedCount > 0 ? "bad" : "good",
          },
        ],
        href: llmCalls[0] ? `/debug/llm-io/${llmCalls[0].id}` : undefined,
      }}
      summary={[
        { label: "LLM call", value: `${llmCalls.length}` },
        {
          label: "총 token",
          value: formatNumber(
            llmCalls.reduce((sum, item) => sum + item.totalTokens, 0),
          ),
        },
        {
          label: "총 비용",
          value: formatCost(totalCost),
          tone: totalCost > 1 ? "warning" : "neutral",
        },
        {
          label: "평균 latency",
          value: formatMs(averageNumbers(llmCalls.map((item) => item.latency))),
        },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={llmCalls}
        emptyText={t("empty.llmIo")}
        footer={summaryFooter(t, data?.page.total, llmCalls.length)}
        hasNextPage={data?.page.hasMore}
        isLoading={llmCallsQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function ErrorsTable({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const errorsQuery = useDebugErrorsQuery(query);
  const data = runtimeConfig.demoMode ? demoDebugErrors : errorsQuery.data;
  const errors = data?.errors ?? [];
  const openCount = errors.filter((item) => item.status === "open").length;
  const columns = useMemo<ColumnDef<DebugErrorGroupDto>[]>(
    () => [
      textColumn("title", t("columns.error")),
      textColumn("errorType", t("columns.type")),
      badgeColumn("severity", t("columns.severity")),
      valueColumn("occurrenceCount", t("columns.occurrences")),
      valueColumn("affectedSessions", t("columns.sessions")),
      textColumn("relatedTool", t("columns.tool")),
      textColumn("lastSeenAt", t("columns.lastSeen"), formatTime),
      badgeColumn("status", t("columns.status")),
      detailColumn(
        t("columns.detail"),
        (item) => `/debug/errors/${item.fingerprint}`,
      ),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="반복 에러가 생기면 fingerprint 기준으로 묶어서 영향 범위와 대표 trace를 보여줍니다."
      emptyText={t("empty.errors")}
      filters={{
        basic: ["severity", "status", "error type", "기간"],
        advanced: [
          "fingerprint",
          "tool",
          "model",
          "agent",
          "representative trace",
        ],
      }}
      hasData={errors.length > 0}
      insight={{
        title: errors[0]?.title ?? "반복 에러 그룹이 없습니다",
        description:
          "개별 로그가 아니라 같은 원인으로 묶인 이슈를 먼저 확인하세요. 대표 trace에서 실제 실패 지점을 추적할 수 있습니다.",
        badges: [
          { label: errors[0]?.errorType ?? "error group", tone: "neutral" },
          {
            label: errors[0]?.severity ?? "INFO",
            tone: errors[0]?.severity === "CRITICAL" ? "bad" : "warning",
          },
          {
            label: errors[0]?.status ?? "resolved",
            tone: errors[0]?.status === "open" ? "bad" : "neutral",
          },
        ],
        href: errors[0] ? `/debug/errors/${errors[0].fingerprint}` : undefined,
      }}
      summary={[
        {
          label: "열린 에러 그룹",
          value: `${openCount}`,
          tone: openCount > 0 ? "bad" : "good",
        },
        {
          label: "총 발생",
          value: formatNumber(
            errors.reduce((sum, item) => sum + item.occurrenceCount, 0),
          ),
          tone: "warning",
        },
        {
          label: "영향 세션",
          value: formatNumber(
            errors.reduce((sum, item) => sum + item.affectedSessions, 0),
          ),
        },
        {
          label: "최다 에러 타입",
          value: getMostCommon(errors.map((item) => item.errorType)),
        },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={errors}
        emptyText={t("empty.errors")}
        footer={summaryFooter(t, data?.page.total, errors.length)}
        hasNextPage={data?.page.hasMore}
        isLoading={errorsQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function RootCauseView({
  sessionId,
  workspaceId,
}: {
  sessionId?: string;
  workspaceId?: string;
}) {
  const t = useTranslations("debug");
  const rootCauseQuery = useDebugRootCauseQuery(sessionId, { workspaceId });
  const data = runtimeConfig.demoMode
    ? demoDebugRootCause
    : rootCauseQuery.data;
  const candidates = data?.candidates ?? [];
  const primary =
    candidates.find((item) => item.id === data?.primaryCandidateId) ??
    candidates[0];
  const columns = useMemo<ColumnDef<DebugRootCauseCandidateDto>[]>(
    () => [
      textColumn("title", t("columns.candidate")),
      textColumn("category", t("columns.category")),
      badgeColumn("severity", t("columns.severity")),
      valueColumn("confidence", t("columns.confidence"), formatPercent),
      textColumn("explanation", t("columns.explanation")),
      detailColumn(
        t("columns.detail"),
        () => `/debug/root-cause/${data?.sessionId ?? "demo-session-1"}`,
      ),
    ],
    [data?.sessionId, t],
  );

  return (
    <AnalysisLayout
      emptyDescription="실패가 있는 trace를 선택하면 에이전트, prompt version, tool 조합 기준의 원인 후보가 표시됩니다."
      emptyText={t("empty.rootCause")}
      filters={{
        basic: ["agent", "prompt version", "tool", "model"],
        advanced: ["deployment", "guardrail", "category", "confidence"],
      }}
      hasData={candidates.length > 0}
      insight={{
        title: primary?.title ?? "원인 후보가 아직 없습니다",
        description:
          data?.summary ??
          "문제가 많은 에이전트, 모델, 도구 조합을 우선순위로 보여주는 화면입니다.",
        badges: [
          { label: primary?.category ?? "candidate", tone: "neutral" },
          {
            label: primary?.severity ?? "INFO",
            tone: primary?.severity === "CRITICAL" ? "bad" : "warning",
          },
          { label: formatPercent(primary?.confidence), tone: "good" },
        ],
        href: data?.sessionId
          ? `/debug/root-cause/${data.sessionId}`
          : undefined,
      }}
      summary={[
        { label: "원인 후보", value: `${candidates.length}` },
        {
          label: "분석 신뢰도",
          value: formatPercent(data?.confidence),
          tone: "good",
        },
        {
          label: "추천 액션",
          value: `${data?.recommendedActions.length ?? 0}`,
        },
        { label: "분석 방식", value: data?.analysisMethod ?? "-" },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={candidates}
        emptyText={t("empty.rootCause")}
        isLoading={rootCauseQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function FailurePatternsView({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const patternsQuery = useDebugPatternsQuery(query);
  const data = runtimeConfig.demoMode ? demoDebugPatterns : patternsQuery.data;
  const patterns = data?.patterns ?? [];
  const topPattern = patterns[0];
  const columns = useMemo<ColumnDef<DebugFailurePatternDto>[]>(
    () => [
      textColumn("name", t("columns.pattern")),
      badgeColumn("severity", t("columns.severity")),
      valueColumn("occurrenceCount", t("columns.occurrences")),
      textColumn("exampleSessionId", t("columns.exampleSession")),
      textColumn("lastSeenAt", t("columns.lastSeen"), formatTime),
      detailColumn(
        t("columns.detail"),
        (item) => `/debug/failure-patterns/${item.id}`,
      ),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="반복 tool call, timeout, 비용 급증 같은 패턴이 감지되면 대표 trace와 함께 보여줍니다."
      emptyText={t("empty.patterns")}
      filters={{
        basic: ["timeout", "loop", "guardrail", "cost spike"],
        advanced: ["prompt version", "tool name", "model", "recent"],
      }}
      hasData={patterns.length > 0}
      insight={{
        title: topPattern?.name ?? "반복 패턴이 아직 없습니다",
        description:
          "개별 에러보다 넓게 반복 행동을 묶어 보여주기 때문에, AI가 어디서 같은 실수를 반복하는지 빠르게 볼 수 있습니다.",
        badges: [
          {
            label: topPattern?.severity ?? "INFO",
            tone: topPattern?.severity === "CRITICAL" ? "bad" : "neutral",
          },
          {
            label: `${topPattern?.occurrenceCount ?? 0}회 발생`,
            tone: "warning",
          },
          {
            label: topPattern?.signature.toolName ?? "signature",
            tone: "neutral",
          },
        ],
        href: topPattern
          ? `/debug/failure-patterns/${topPattern.id}`
          : undefined,
      }}
      summary={[
        { label: "감지 패턴", value: `${patterns.length}` },
        {
          label: "총 발생",
          value: formatNumber(
            patterns.reduce((sum, item) => sum + item.occurrenceCount, 0),
          ),
          tone: "warning",
        },
        {
          label: "영향 에이전트",
          value: formatNumber(
            new Set(patterns.flatMap((item) => item.affectedAgents)).size,
          ),
        },
        { label: "최다 패턴", value: topPattern?.name ?? "-" },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={patterns}
        emptyText={t("empty.patterns")}
        isLoading={patternsQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function ReproduceView({
  sessionId,
  workspaceId,
}: {
  sessionId?: string;
  workspaceId?: string;
}) {
  const t = useTranslations("debug");
  const reproduceMutation = useDebugReproduceMutation(sessionId ?? "");
  const shouldUseDemo =
    runtimeConfig.demoMode && (!sessionId || sessionId.startsWith("demo-"));
  useEffect(() => {
    if (shouldUseDemo || !sessionId || !workspaceId) return;
    reproduceMutation.mutate({ workspaceId, mode: "DRY_RUN" });
    // 세션이 바뀔 때마다 원본 실행을 다시 분석해 재현 패키지를 갱신합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, workspaceId]);

  const data = shouldUseDemo ? demoDebugReproduce : reproduceMutation.data;
  const steps = data?.steps ?? [];
  const columns = useMemo<ColumnDef<DebugReproduceStepDto>[]>(
    () => [
      valueColumn("order", t("columns.order")),
      textColumn("label", t("columns.step")),
      textColumn("eventType", t("columns.eventType")),
      badgeColumn("status", t("columns.status")),
      textColumn("reason", t("columns.reason")),
      detailColumn(
        t("columns.detail"),
        () => `/debug/reproduce/${data?.sourceSessionId ?? "demo-session-1"}`,
      ),
    ],
    [data?.sourceSessionId, t],
  );

  return (
    <AnalysisLayout
      emptyDescription="traceId 또는 sessionId를 입력하면 당시 prompt, model setting, tool arguments, context snapshot으로 재현 준비 상태를 보여줍니다."
      emptyText={t("empty.reproduce")}
      filters={{
        basic: ["traceId", "sessionId", "dry-run", "replay"],
        advanced: [
          "prompt version",
          "agent version",
          "policy version",
          "SDK version",
        ],
      }}
      hasData={steps.length > 0}
      insight={{
        title: data?.summary ?? "재현 가능한 실행을 선택하세요",
        description:
          "Replay와 dry-run을 분리해서 원본 실행과 재현 실행의 차이를 비교하는 화면입니다.",
        badges: [
          { label: data?.mode ?? "DRY_RUN", tone: "neutral" },
          {
            label: data?.status ?? "READY",
            tone: data?.status === "FAILED" ? "bad" : "good",
          },
          { label: formatPercent(data?.deterministicScore), tone: "warning" },
        ],
        href: data?.sourceSessionId
          ? `/debug/reproduce/${data.sourceSessionId}`
          : undefined,
      }}
      summary={[
        { label: "재현 단계", value: `${steps.length}` },
        {
          label: "매칭 단계",
          value: `${steps.filter((item) => item.status === "MATCHED").length}`,
          tone: "good",
        },
        {
          label: "변경/실패",
          value: `${steps.filter((item) => item.status === "CHANGED" || item.status === "FAILED").length}`,
          tone: "warning",
        },
        { label: "재현 점수", value: formatPercent(data?.deterministicScore) },
      ]}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!sessionId || !workspaceId || reproduceMutation.isPending}
          size="sm"
          type="button"
          onClick={() =>
            sessionId &&
            workspaceId &&
            reproduceMutation.mutate({ workspaceId, mode: "REPLAY" })
          }
        >
          Replay
        </Button>
        <Button
          disabled={!sessionId || !workspaceId || reproduceMutation.isPending}
          size="sm"
          type="button"
          variant="outline"
          onClick={() =>
            sessionId &&
            workspaceId &&
            reproduceMutation.mutate({ workspaceId, mode: "DRY_RUN" })
          }
        >
          Dry-run
        </Button>
      </div>
      {data?.replayPackage ? <ReplayPackagePanel data={data} /> : null}
      <ServerDataTable
        columns={columns}
        data={steps}
        emptyText={t("empty.reproduce")}
        isLoading={reproduceMutation.isPending && !shouldUseDemo}
      />
    </AnalysisLayout>
  );
}

function ReplayPackagePanel({ data }: { data: DebugReproduceResponseDto }) {
  const replayPackage = data.replayPackage;
  if (!replayPackage) return null;

  return (
    <DashboardPanel className="space-y-4">
      <div>
        <p className="text-sm font-semibold">재현 패키지</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          원본 입력, 모델 설정, 도구 인자, 컨텍스트 근거를 묶어 운영 검토와
          감사 기록에 사용할 수 있게 정리했습니다.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniFact label="입력" value={replayPackage.userInput ?? "-"} />
        <MiniFact
          label="프롬프트 버전"
          value={replayPackage.promptVersion ?? "-"}
        />
        <MiniFact label="SDK 버전" value={replayPackage.sdkVersion ?? "-"} />
        <MiniFact label="환경" value={replayPackage.environment ?? "-"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <ReplayList
          emptyText="기록된 모델 호출이 없습니다."
          items={replayPackage.modelSettings.map((item) => ({
            id: item.eventId,
            title: item.model ?? item.provider ?? "unknown model",
            description: item.requestPreview ?? "요청 미리보기가 없습니다.",
          }))}
          title="모델 설정"
        />
        <ReplayList
          emptyText="기록된 도구 호출이 없습니다."
          items={replayPackage.toolCalls.map((item) => ({
            id: item.eventId,
            title: item.toolName,
            description:
              item.argumentsPreview ??
              (item.sideEffect ? "side effect 있음" : "read-only"),
          }))}
          title="도구 인자"
        />
        <ReplayList
          emptyText="기록된 컨텍스트가 없습니다."
          items={replayPackage.contextSnapshots.map((item) => ({
            id: item.eventId,
            title: item.label,
            description: item.preview ?? "컨텍스트 미리보기가 없습니다.",
          }))}
          title="컨텍스트"
        />
      </div>
    </DashboardPanel>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 break-words text-sm font-semibold [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function ReplayList({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: Array<{ id: string; title: string; description: string }>;
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => (
            <div key={item.id} className="min-w-0 rounded-md bg-muted/20 p-2">
              <p className="line-clamp-1 break-all text-xs font-semibold">
                {item.title}
              </p>
              <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {item.description}
              </p>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}

function BottleneckView({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const bottlenecksQuery = useDebugBottlenecksQuery(query);
  const data = runtimeConfig.demoMode
    ? demoDebugBottlenecks
    : bottlenecksQuery.data;
  const bottlenecks = data?.bottlenecks ?? [];
  const slowest = [...bottlenecks].sort(
    (a, b) => b.p95Latency - a.p95Latency,
  )[0];
  const columns = useMemo<ColumnDef<DebugBottleneckItemDto>[]>(
    () => [
      textColumn("label", t("columns.label")),
      badgeColumn("type", t("columns.type")),
      valueColumn("count", t("columns.count")),
      valueColumn("avgLatency", t("columns.avgLatency"), formatMs),
      valueColumn("p95Latency", t("columns.p95"), formatMs),
      valueColumn("affectedSessions", t("columns.sessions")),
      textColumn("trend", t("columns.trend")),
      detailColumn(
        t("columns.detail"),
        (item) => `/debug/bottleneck/${encodeURIComponent(item.id)}`,
      ),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="느린 span이 수집되면 LLM, Tool, DB/API, context loading 중 어디를 먼저 고쳐야 하는지 보여줍니다."
      emptyText={t("empty.bottleneck")}
      filters={{
        basic: ["LLM", "Tool", "Memory", "Context"],
        advanced: ["Policy", "p95", "critical path", "trend"],
      }}
      hasData={bottlenecks.length > 0}
      insight={{
        title: slowest
          ? `${slowest.label} 병목을 먼저 확인하세요`
          : "병목 후보가 아직 없습니다",
        description:
          "critical path와 p95 지연을 기준으로 가장 효과가 큰 개선 후보를 먼저 보여줍니다.",
        badges: [
          { label: slowest?.type ?? "critical path", tone: "neutral" },
          { label: formatMs(slowest?.p95Latency), tone: "warning" },
          { label: `${slowest?.affectedSessions ?? 0} sessions`, tone: "bad" },
        ],
        href: slowest
          ? `/debug/bottleneck/${encodeURIComponent(slowest.id)}`
          : undefined,
      }}
      summary={[
        { label: "병목 후보", value: `${bottlenecks.length}` },
        {
          label: "최대 p95",
          value: formatMs(slowest?.p95Latency),
          tone: "warning",
        },
        { label: "영향 세션", value: `${slowest?.affectedSessions ?? 0}` },
        { label: "가장 느린 구간", value: slowest?.label ?? "-" },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={bottlenecks}
        emptyText={t("empty.bottleneck")}
        isLoading={bottlenecksQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function LatencyView({
  query,
}: {
  query: { workspaceId?: string; limit: number };
}) {
  const t = useTranslations("debug");
  const latencyQuery = useDebugLatencyQuery(query);
  const data = runtimeConfig.demoMode ? demoDebugLatency : latencyQuery.data;
  const buckets = data?.buckets ?? [];
  const slowestBucket = [...buckets].sort((a, b) => b.p99 - a.p99)[0];
  const columns = useMemo<ColumnDef<DebugLatencyBucketDto>[]>(
    () => [
      textColumn("bucket", t("columns.time"), formatTime),
      valueColumn("count", t("columns.count")),
      valueColumn("p50", t("columns.p50"), formatMs),
      valueColumn("p95", t("columns.p95"), formatMs),
      valueColumn("p99", t("columns.p99"), formatMs),
      detailColumn(
        t("columns.detail"),
        (item) => `/debug/latency/${encodeURIComponent(item.bucket)}`,
      ),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="Latency 이벤트가 쌓이면 p50, p95, p99와 timeout 비율을 기준으로 이상치를 찾을 수 있습니다."
      emptyText={t("empty.latency")}
      filters={{
        basic: ["p50", "p95", "p99", "timeout"],
        advanced: ["agent", "tool", "model", "deployment"],
      }}
      hasData={buckets.length > 0}
      insight={{
        title: slowestBucket
          ? `${formatTime(slowestBucket.bucket)} 구간의 p99를 확인하세요`
          : "지연 시간 분포가 아직 없습니다",
        description:
          "전체 성능 추세를 보되, 느린 요청 top list와 trace로 바로 들어갈 수 있게 구성했습니다.",
        badges: [
          { label: `p95 ${formatMs(data?.summary.p95)}`, tone: "warning" },
          {
            label: `${data?.summary.slowEventCount ?? 0} slow events`,
            tone: "bad",
          },
          { label: `p99 ${formatMs(data?.summary.p99)}`, tone: "warning" },
        ],
        href: slowestBucket
          ? `/debug/latency/${encodeURIComponent(slowestBucket.bucket)}`
          : undefined,
      }}
      summary={[
        { label: "평균 latency", value: formatMs(data?.summary.avgLatency) },
        { label: "p50", value: formatMs(data?.summary.p50) },
        { label: "p95", value: formatMs(data?.summary.p95), tone: "warning" },
        { label: "p99", value: formatMs(data?.summary.p99), tone: "bad" },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={buckets}
        emptyText={t("empty.latency")}
        isLoading={latencyQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function MemoryView({
  sessionId,
  workspaceId,
}: {
  sessionId?: string;
  workspaceId?: string;
}) {
  const t = useTranslations("debug");
  const memoryQuery = useDebugMemoryQuery(sessionId, { workspaceId });
  const data = runtimeConfig.demoMode ? demoDebugMemory : memoryQuery.data;
  const accesses = data?.accesses ?? [];
  const staleAccess = accesses.find((item) => item.stale);
  const columns = useMemo<ColumnDef<DebugMemoryAccessDto>[]>(
    () => [
      badgeColumn("operation", t("columns.operation")),
      textColumn("key", t("columns.key")),
      valueColumn("hit", t("columns.hit"), formatBoolean),
      valueColumn("stale", t("columns.stale"), formatBoolean),
      textColumn("timestamp", t("columns.time"), formatTime),
      textColumn("summary", t("columns.summary")),
      detailColumn(
        t("columns.detail"),
        (item) => `/debug/memory/${item.eventId}`,
      ),
    ],
    [t],
  );

  return (
    <AnalysisLayout
      emptyDescription="Memory/context 이벤트가 수집되면 stale memory, miss, 불필요한 context 의심 항목을 보여줍니다."
      emptyText={t("empty.memory")}
      filters={{
        basic: ["hit", "miss", "stale", "context token"],
        advanced: [
          "polluted",
          "cost increase",
          "latency increase",
          "sessionId",
        ],
      }}
      hasData={accesses.length > 0}
      insight={{
        title: staleAccess?.summary ?? "context 품질 신호를 확인하세요",
        description:
          "단순 용량이 아니라 memory/context가 실패, 비용, 지연에 영향을 주는지 진단하는 화면입니다.",
        badges: [
          { label: `${data?.hitCount ?? 0} hit`, tone: "good" },
          {
            label: `${data?.memoryMissCount ?? 0} miss`,
            tone: data?.memoryMissCount ? "warning" : "neutral",
          },
          {
            label: `${data?.staleMemoryCount ?? 0} stale`,
            tone: data?.staleMemoryCount ? "bad" : "good",
          },
        ],
        href: staleAccess ? `/debug/memory/${staleAccess.eventId}` : undefined,
      }}
      summary={[
        { label: "memory read/write", value: `${accesses.length}` },
        { label: "hit", value: `${data?.hitCount ?? 0}`, tone: "good" },
        {
          label: "miss",
          value: `${data?.memoryMissCount ?? 0}`,
          tone: data?.memoryMissCount ? "warning" : "neutral",
        },
        {
          label: "stale",
          value: `${data?.staleMemoryCount ?? 0}`,
          tone: data?.staleMemoryCount ? "bad" : "good",
        },
      ]}
    >
      <ServerDataTable
        columns={columns}
        data={accesses}
        emptyText={t("empty.memory")}
        isLoading={memoryQuery.isLoading && !runtimeConfig.demoMode}
      />
    </AnalysisLayout>
  );
}

function AnalysisLayout({
  summary,
  insight,
  filters,
  hasData,
  emptyText,
  emptyDescription,
  children,
}: {
  summary: Array<{
    label: string;
    value: string;
    description?: string;
    tone?: "neutral" | "good" | "warning" | "bad";
  }>;
  insight: {
    title: string;
    description: string;
    badges: Array<{
      label: string;
      tone?: "neutral" | "good" | "warning" | "bad";
    }>;
    href?: string;
  };
  filters: { basic: string[]; advanced: string[] };
  hasData: boolean;
  emptyText: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <DebugSummaryCard
            key={item.label}
            description={item.description}
            label={item.label}
            tone={item.tone}
            value={item.value}
          />
        ))}
      </div>
      <DebugInsightPanel {...insight} />
      <DebugFilterBar
        advancedFilters={filters.advanced}
        advancedTitle="고급 필터"
        basicFilters={filters.basic}
        basicTitle="기본 필터"
      />
      {hasData ? (
        children
      ) : (
        <DebugEmptyState
          description={emptyDescription}
          sampleTraceLabel="샘플 trace 보기"
          sdkGuideLabel="SDK 연결 가이드"
          sendTestEventLabel="테스트 이벤트 전송"
          title={emptyText}
        />
      )}
    </div>
  );
}

function TraceNodeRow({
  node,
  isCritical,
}: {
  node: DebugTimelineNodeDto;
  isCritical: boolean;
}) {
  const width = Math.min(100, Math.max(8, ((node.latency ?? 0) / 12000) * 100));

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/20 p-3"
      style={{ marginLeft: `${Math.min(node.depth, 4) * 18}px` }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <IssueBadge
              label={node.eventType}
              tone={
                node.severity === "CRITICAL"
                  ? "bad"
                  : isCritical
                    ? "warning"
                    : "neutral"
              }
            />
            {isCritical ? (
              <IssueBadge label="critical path" tone="warning" />
            ) : null}
            {node.error ? <IssueBadge label="failed" tone="bad" /> : null}
          </div>
          <p className="mt-2 font-medium">{node.label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {node.summary ?? node.error ?? "-"}
          </p>
        </div>
        <div className="w-full shrink-0 md:w-44">
          <p className="text-right text-xs font-medium tabular-nums text-muted-foreground">
            {formatMs(node.latency)}
          </p>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function textColumn<TData extends object>(
  key: keyof TData & string,
  header: string,
  formatter?: (value: unknown) => string,
): ColumnDef<TData> {
  return {
    accessorKey: key,
    header,
    cell: ({ getValue }) => (
      <span className="block max-w-[320px] truncate">
        {formatter ? formatter(getValue()) : String(getValue() ?? "-")}
      </span>
    ),
  };
}

function valueColumn<TData extends object>(
  key: keyof TData & string,
  header: string,
  formatter?: (value: unknown) => string,
): ColumnDef<TData> {
  return {
    accessorKey: key,
    header,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs tabular-nums">
        {formatter ? formatter(getValue()) : String(getValue() ?? "-")}
      </span>
    ),
  };
}

function badgeColumn<TData extends object>(
  key: keyof TData & string,
  header: string,
): ColumnDef<TData> {
  return {
    accessorKey: key,
    header,
    cell: ({ getValue }) => (
      <IssueBadge
        label={String(getValue() ?? "-")}
        tone={badgeTone(getValue())}
      />
    ),
  };
}

function detailColumn<TData extends object>(
  header: string,
  getHref: (item: TData) => string,
): ColumnDef<TData> {
  return {
    id: "detail",
    header,
    cell: ({ row }) => (
      <Button asChild size="xs" variant="outline">
        <Link href={getHref(row.original)}>
          {header}
          <ArrowRight className="size-3" />
        </Link>
      </Button>
    ),
  };
}

function sessionLinkColumn(
  header: string,
): ColumnDef<DebugLlmCallItemDto> {
  return {
    id: "session",
    header,
    cell: ({ row }) => (
      <Button asChild size="xs" variant="ghost">
        <Link href={`/dashboard/session/${row.original.sessionId}`}>
          {shortId(row.original.sessionId)}
          <ArrowRight className="size-3" />
        </Link>
      </Button>
    ),
  };
}

function summaryFooter(
  t: ReturnType<typeof useTranslations>,
  total?: number,
  displayed?: number,
) {
  if (!total || !displayed || total <= displayed) return undefined;
  return t("table.remaining", { count: total - displayed });
}

function isCriticalEvent(event: DebugEventLogItemDto) {
  return (
    event.severity === "CRITICAL" ||
    event.eventType === "ERROR" ||
    Boolean(event.error)
  );
}

function badgeTone(value: unknown): "neutral" | "good" | "warning" | "bad" {
  const normalized = String(value ?? "").toLowerCase();
  if (
    normalized.includes("success") ||
    normalized.includes("resolved") ||
    normalized.includes("matched") ||
    normalized === "info"
  ) {
    return "good";
  }
  if (
    normalized.includes("critical") ||
    normalized.includes("fail") ||
    normalized.includes("timeout") ||
    normalized.includes("open") ||
    normalized.includes("destructive")
  ) {
    return "bad";
  }
  if (
    normalized.includes("warning") ||
    normalized.includes("retry") ||
    normalized.includes("investigating") ||
    normalized.includes("write") ||
    normalized.includes("changed") ||
    normalized.includes("skipped")
  ) {
    return "warning";
  }
  return "neutral";
}

function formatTime(value: unknown) {
  if (typeof value !== "string") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMs(value: unknown) {
  return typeof value === "number"
    ? `${Math.round(value).toLocaleString("ko-KR")}ms`
    : "-";
}

function formatCost(value: unknown) {
  return typeof value === "number" ? `$${value.toFixed(3)}` : "-";
}

function formatPercent(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-";
}

function formatBoolean(value: unknown) {
  if (typeof value !== "boolean") return "-";
  return value ? "Y" : "N";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function averageNumbers(values: Array<number | undefined>) {
  const numbers = values.filter(
    (value): value is number => typeof value === "number",
  );
  if (numbers.length === 0) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function formatRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return "0";
  return ((numerator / denominator) * 100).toFixed(1);
}

function getMostCommon(values: Array<string | undefined>) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  let winner = "-";
  let maxCount = 0;
  counts.forEach((count, value) => {
    if (count > maxCount) {
      winner = value;
      maxCount = count;
    }
  });

  return winner;
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...`;
}
