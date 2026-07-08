"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clipboard,
  Database,
  MessageSquare,
  OctagonAlert,
  RefreshCcw,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import type { SessionFlowNodeDto, SessionTimelineResponseDto } from "@repo/dto";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import {
  useSessionDetailQuery,
  useSessionTimelineQuery,
} from "@/hooks/queries/session";
import {
  demoSessionDetail,
  demoSessionTimeline,
} from "@/services/session-demo-fixtures";
import { RelatedInvestigationPanel } from "@/components/investigation/related-investigation";
import {
  SessionIssueBadge,
  SessionStatusBadge,
  SessionSummaryCard,
} from "./session-page-view";

type TimelineTab = "timeline" | "flow" | "raw";

const FLOW_LANES = ["Input", "Context", "LLM", "Tool", "Outcome"] as const;
const FLOW_LANE_HEIGHT = 126;
const FLOW_TOP_OFFSET = 78;
const FLOW_LEFT_OFFSET = 148;
const FLOW_NODE_GAP = 96;
const FLOW_NODE_WIDTH = 280;
const FLOW_NODE_HEIGHT = 96;

export function SessionDetailView({ sessionId }: { sessionId?: string }) {
  const t = useTranslations("session");
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const resolvedSessionId = sessionId ?? "demo-session-1";
  const query = useMemo(() => ({ workspaceId }), [workspaceId]);
  const detailQuery = useSessionDetailQuery(resolvedSessionId, query);
  const timelineQuery = useSessionTimelineQuery(resolvedSessionId, query);
  const detail = runtimeConfig.demoMode ? demoSessionDetail : detailQuery.data;
  const timeline = runtimeConfig.demoMode
    ? demoSessionTimeline
    : timelineQuery.data;
  const defaultNodeId = useMemo(
    () => (timeline ? getDefaultSelectedNodeId(timeline) : undefined),
    [timeline],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<TimelineTab>("timeline");

  useEffect(() => {
    setSelectedNodeId(defaultNodeId);
  }, [defaultNodeId]);

  const effectiveSelectedNodeId = selectedNodeId ?? defaultNodeId;
  const selectedNode =
    timeline?.nodes.find((node) => node.id === effectiveSelectedNodeId) ??
    timeline?.nodes[0];

  if (!workspaceId && !runtimeConfig.demoMode) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("empty.workspace")}
        </p>
      </DashboardPanel>
    );
  }

  if (!detail || !timeline) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("detail.loading")}
        </p>
      </DashboardPanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SessionSummaryCard label={t("summary.status")} value={detail.status} />
        <SessionSummaryCard
          label={t("summary.duration")}
          value={formatMs(detail.durationMs)}
        />
        <SessionSummaryCard
          label={t("summary.tokens")}
          value={formatNumber(detail.totalTokens)}
        />
        <SessionSummaryCard
          label={t("summary.cost")}
          value={formatCost(detail.totalCost)}
          tone={detail.totalCost > 1 ? "warning" : "neutral"}
        />
        <SessionSummaryCard
          label={t("summary.calls")}
          value={`${detail.llmCallCount}/${detail.toolCallCount}`}
        />
      </div>

      <DashboardPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SessionStatusBadge
                status={detail.status}
                severity={detail.severity}
              />
              {detail.issueBadges.length > 0 ? (
                detail.issueBadges.map((badge) => (
                  <SessionIssueBadge key={badge.type} badge={badge} />
                ))
              ) : (
                <SessionIssueBadge
                  badge={{
                    label: t("badges.normal"),
                    type: "normal",
                    tone: "good",
                  }}
                />
              )}
            </div>
            <p className="mt-3 text-lg font-semibold tracking-normal">
              {detail.runId}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {detail.agentName} ·{" "}
              {detail.rootCauseCandidate ?? t("list.noRootCause")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.recommendedActions.map((action) => (
              <Button asChild key={action.href} size="sm" variant="outline">
                <Link href={action.href}>
                  {action.label}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </DashboardPanel>

      <RootCauseCandidateBox timeline={timeline} />

      <RelatedInvestigationPanel
        description="이 세션에서 발견한 실패 지점, span, tool/model 신호를 디버깅 화면으로 넘겨 원인과 패턴을 확정합니다."
        items={[
          {
            label: "세션",
            value: detail.sessionId,
            href: `/dashboard/session/${detail.sessionId}`,
          },
          {
            label: "Trace",
            value: detail.traceId ?? "-",
            href: `/debug/trace?sessionId=${detail.sessionId}`,
          },
          {
            label: "에이전트",
            value: detail.agentName,
            href: `/agents/${detail.agentId}`,
          },
          {
            label: "주요 이슈",
            value: detail.primaryIssue ?? detail.severity,
            href: `/debug/errors?sessionId=${detail.sessionId}&agentId=${detail.agentId}`,
          },
        ]}
        actions={[
          {
            label: "Open Trace",
            href: `/debug/trace?sessionId=${detail.sessionId}&agentId=${detail.agentId}`,
          },
          {
            label: "Open Logs",
            href: `/debug/logs?sessionId=${detail.sessionId}&agentId=${detail.agentId}`,
          },
          {
            label: "Open Error Report",
            href: `/debug/errors?sessionId=${detail.sessionId}&agentId=${detail.agentId}`,
          },
          {
            label: "Reproduce",
            href: `/debug/reproduce/${detail.sessionId}?agentId=${detail.agentId}`,
          },
        ]}
      />

      <div
        className={
          activeTab === "flow"
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_440px]"
        }
      >
        <div className="min-w-0 space-y-3">
          <TimelineTabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === "timeline" ? (
            <VerticalTimeline
              selectedNodeId={selectedNode?.id}
              timeline={timeline}
              onSelectNode={setSelectedNodeId}
            />
          ) : activeTab === "flow" ? (
            <SessionFlowView
              selectedNodeId={selectedNode?.id}
              timeline={timeline}
              onSelectNode={setSelectedNodeId}
            />
          ) : (
            <RawEventsView
              selectedNodeId={selectedNode?.id}
              timeline={timeline}
              onSelectNode={setSelectedNodeId}
            />
          )}
        </div>
        <div
          className={
            activeTab === "flow" ? "min-w-0" : "min-w-0 2xl:sticky 2xl:top-20 2xl:self-start"
          }
        >
          <SessionNodeDetailPanel node={selectedNode} />
        </div>
      </div>
    </div>
  );
}

function RootCauseCandidateBox({
  timeline,
}: {
  timeline: SessionTimelineResponseDto;
}) {
  const failedNode =
    timeline.nodes.find((node) => node.id === timeline.failedNodeId) ??
    timeline.nodes.find((node) => node.status === "error");
  const warningNode = timeline.nodes.find((node) => node.status === "warning");
  const candidate = failedNode ?? warningNode;
  const retryCount = timeline.nodes.filter(
    (node) => node.type === "retry",
  ).length;
  const relatedName = candidate?.toolName ?? candidate?.model ?? "-";

  return (
    <DashboardPanel className="border-amber-200/70 bg-amber-50/35">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-amber-700">
            Root cause candidate
          </p>
          <p className="mt-2 text-base font-semibold tracking-normal">
            {candidate?.issueBadges[0]?.reason ??
              candidate?.preview ??
              "아직 명확한 실패 후보가 없습니다."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Failed step: {candidate?.label ?? "-"}</span>
            <span>Related: {relatedName}</span>
            <span>Retry: {retryCount}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/debug/errors">에러 리포트 보기</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/debug/reproduce/${timeline.session.sessionId}`}>
              재현하기
            </Link>
          </Button>
        </div>
      </div>
    </DashboardPanel>
  );
}

function TimelineTabs({
  activeTab,
  onChange,
}: {
  activeTab: TimelineTab;
  onChange: (tab: TimelineTab) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/50 bg-background p-1">
      {(["timeline", "flow", "raw"] as const).map((tab) => (
        <button
          key={tab}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === tab
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          type="button"
          onClick={() => onChange(tab)}
        >
          {tab === "timeline"
            ? "Timeline"
            : tab === "flow"
              ? "Flow"
              : "Raw Events"}
        </button>
      ))}
    </div>
  );
}

function VerticalTimeline({
  timeline,
  selectedNodeId,
  onSelectNode,
}: {
  timeline: SessionTimelineResponseDto;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <DashboardPanel className="p-0">
      <div className="max-h-[720px] overflow-y-auto px-4 py-3">
        <div className="relative">
          <div className="absolute bottom-4 left-[25px] top-4 w-px bg-border" />
          <div className="space-y-2">
            {timeline.nodes.map((node, index) => (
              <TimelineRow
                key={node.id}
                index={index}
                isCritical={timeline.criticalNodeIds.includes(node.id)}
                isFailed={timeline.failedNodeId === node.id}
                isSelected={selectedNodeId === node.id}
                node={node}
                onClick={() => onSelectNode(node.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}

function TimelineRow({
  node,
  index,
  isCritical,
  isFailed,
  isSelected,
  onClick,
}: {
  node: SessionFlowNodeDto;
  index: number;
  isCritical: boolean;
  isFailed: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = nodeIcon(node.type);
  const tone =
    isFailed || node.status === "error"
      ? "bad"
      : isCritical || node.status === "warning"
        ? "warning"
        : "neutral";

  return (
    <button
      className={`relative flex w-full gap-3 rounded-lg border px-3 py-2.5 text-left transition hover:bg-muted/20 ${
        isSelected ? "border-primary bg-muted/30" : "border-transparent"
      }`}
      type="button"
      onClick={onClick}
    >
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
        <span
          className={`flex size-8 items-center justify-center rounded-full ${iconToneClass(
            tone,
          )}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              #{index + 1}
            </span>
            <p className="truncate text-sm font-semibold">{node.label}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span>{node.status}</span>
            <span>{formatMs(node.latencyMs)}</span>
            <span>{formatNodeTime(node.timestamp)}</span>
          </div>
        </div>
        <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
          {node.preview ?? "-"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.issueBadges.length > 0 ? (
            node.issueBadges
              .slice(0, 3)
              .map((badge) => (
                <SessionIssueBadge
                  key={`${node.id}-${badge.type}`}
                  badge={badge}
                />
              ))
          ) : (
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {node.type}
            </span>
          )}
          {node.tokenCount ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {formatNumber(node.tokenCount)} tokens
            </span>
          ) : null}
          {node.cost ? (
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              {formatCost(node.cost)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function SessionFlowView({
  timeline,
  selectedNodeId,
  onSelectNode,
}: {
  timeline: SessionTimelineResponseDto;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
}) {
  const t = useTranslations("session");
  const layout = buildTimelineLayout(timeline.nodes);
  const nodeById = new Map(layout.nodes.map((item) => [item.node.id, item]));

  return (
    <DashboardPanel className="overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold">{t("detail.flowTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Flow View는 고급 분석용입니다. 기본 탐색은 Timeline View를
            사용하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Legend label="critical" tone="warning" />
          <Legend label="failed" tone="bad" />
          <Legend label="normal" tone="neutral" />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border/40 bg-background">
        <div
          className="relative min-w-[920px]"
          style={{ width: layout.width, height: layout.height }}
        >
          <div className="absolute inset-x-0 top-0 h-16 border-b border-border/40 bg-muted/20">
            <p className="absolute left-4 top-4 text-xs font-semibold text-muted-foreground">
              Flow
            </p>
            {layout.nodes.map((item) => (
              <div
                key={`${item.node.id}-tick`}
                className="absolute top-3 flex -translate-x-1/2 flex-col items-center gap-1"
                style={{ left: item.x + FLOW_NODE_WIDTH / 2 }}
              >
                <span className="h-3 w-px bg-border" />
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {formatNodeTime(item.node.timestamp)}
                </span>
              </div>
            ))}
          </div>

          <div className="absolute left-0 top-16 w-28 border-r border-border/40 bg-background/95">
            {layout.lanes.map((lane) => (
              <div
                key={lane}
                className="flex items-center px-4 text-xs font-semibold text-muted-foreground"
                style={{ height: layout.laneHeight }}
              >
                {lane}
              </div>
            ))}
          </div>

          <div className="absolute left-28 right-0 top-16">
            {layout.lanes.map((lane) => (
              <div
                key={`${lane}-grid`}
                className="border-b border-border/30"
                style={{ height: layout.laneHeight }}
              />
            ))}
          </div>

          <svg
            className="pointer-events-none absolute left-0 top-0"
            height={layout.height}
            width={layout.width}
          >
            {timeline.edges.map((edge) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;

              return (
                <FlowEdge
                  key={edge.id}
                  sourceX={source.x + FLOW_NODE_WIDTH}
                  sourceY={source.y + FLOW_NODE_HEIGHT / 2}
                  status={edge.status}
                  targetX={target.x}
                  targetY={target.y + FLOW_NODE_HEIGHT / 2}
                />
              );
            })}
          </svg>

          {layout.nodes.map((item) => (
            <FlowNode
              key={item.node.id}
              isCritical={timeline.criticalNodeIds.includes(item.node.id)}
              isFailed={timeline.failedNodeId === item.node.id}
              isSelected={selectedNodeId === item.node.id}
              node={item.node}
              x={item.x}
              y={item.y}
              onClick={() => onSelectNode(item.node.id)}
            />
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}

function RawEventsView({
  timeline,
  selectedNodeId,
  onSelectNode,
}: {
  timeline: SessionTimelineResponseDto;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <DashboardPanel className="p-0">
      <div className="max-h-[720px] overflow-y-auto divide-y divide-border/40">
        {timeline.nodes.map((node) => (
          <button
            key={node.id}
            className={`block w-full px-4 py-3 text-left hover:bg-muted/20 ${
              selectedNodeId === node.id ? "bg-muted/30" : ""
            }`}
            type="button"
            onClick={() => onSelectNode(node.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold">{node.label}</p>
              <span className="text-xs text-muted-foreground">{node.type}</span>
            </div>
            <pre className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
              {JSON.stringify(node.detail)}
            </pre>
          </button>
        ))}
      </div>
    </DashboardPanel>
  );
}

function FlowNode({
  node,
  isCritical,
  isFailed,
  isSelected,
  x,
  y,
  onClick,
}: {
  node: SessionFlowNodeDto;
  isCritical: boolean;
  isFailed: boolean;
  isSelected: boolean;
  x: number;
  y: number;
  onClick: () => void;
}) {
  const Icon = nodeIcon(node.type);
  const tone =
    isFailed || node.status === "error"
      ? "bad"
      : isCritical
        ? "warning"
        : "neutral";

  return (
    <button
      className={`absolute overflow-hidden rounded-lg border bg-background p-3 text-left transition hover:bg-muted/30 ${nodeSurfaceClass(
        tone,
      )} ${isSelected ? "border-primary ring-2 ring-primary/15" : "border-border/60"}`}
      style={{
        height: FLOW_NODE_HEIGHT,
        left: x,
        top: y,
        width: FLOW_NODE_WIDTH,
      }}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-md p-1 ${iconToneClass(tone)}`}>
          <Icon className="size-3.5" />
        </span>
        <div className="flex items-center gap-1.5">
          {isCritical ? (
            <span className="size-1.5 rounded-full bg-amber-400" />
          ) : null}
          {isFailed ? (
            <span className="size-1.5 rounded-full bg-rose-500" />
          ) : null}
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {formatMs(node.latencyMs)}
          </span>
        </div>
      </div>
      <p className="mt-2 line-clamp-1 break-all text-sm font-semibold leading-5">
        {node.label}
      </p>
      <p className="mt-1 line-clamp-2 break-all text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]">
        {node.preview ?? "-"}
      </p>
      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 overflow-hidden">
        {node.issueBadges.length > 0 ? (
          node.issueBadges
            .slice(0, 1)
            .map((badge) => (
              <SessionIssueBadge
                key={`${node.id}-${badge.type}`}
                badge={badge}
              />
            ))
        ) : (
          <span className="text-xs text-muted-foreground">{node.type}</span>
        )}
      </div>
    </button>
  );
}

function FlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  status,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  status: "normal" | "retry" | "error" | "blocked";
}) {
  const midX = sourceX + Math.max(40, (targetX - sourceX) / 2);
  const stroke =
    status === "error"
      ? "#fb7185"
      : status === "blocked"
        ? "#f59e0b"
        : status === "retry"
          ? "#38bdf8"
          : "#d4d4d8";

  return (
    <path
      d={`M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`}
      fill="none"
      stroke={stroke}
      strokeDasharray={status === "retry" ? "5 5" : undefined}
      strokeLinecap="round"
      strokeWidth="2"
    />
  );
}

function SessionNodeDetailPanel({ node }: { node?: SessionFlowNodeDto }) {
  const t = useTranslations("session");

  if (!node) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("detail.selectNode")}
        </p>
      </DashboardPanel>
    );
  }

  const errorMessage = readDetailString(node.detail, "error");
  const inputPreview = readDetailString(node.detail, "inputPreview");
  const outputPreview = readDetailString(node.detail, "outputPreview");

  return (
    <DashboardPanel className="min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-base font-semibold leading-6 [overflow-wrap:anywhere]">
            {node.label}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {node.type}
          </p>
        </div>
        <SessionIssueBadge
          badge={{
            label: node.status,
            type: node.status,
            tone:
              node.status === "error" || node.status === "blocked"
                ? "bad"
                : node.status === "warning"
                  ? "warning"
                  : "good",
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DetailMetric label="latency" value={formatMs(node.latencyMs)} />
        <DetailMetric label="token" value={formatNumber(node.tokenCount)} />
        <DetailMetric label="cost" value={formatCost(node.cost)} />
        <DetailMetric
          label="model/tool"
          value={node.model ?? node.toolName ?? "-"}
        />
      </div>

      <div className="mt-4 space-y-3">
        <PreviewBlock label={t("detail.preview")} value={node.preview} />
        {node.issueBadges[0]?.reason ? (
          <PreviewBlock
            label="실패/경고 이유"
            value={node.issueBadges[0].reason}
          />
        ) : null}
        <PreviewBlock label="Input" value={inputPreview} />
        <PreviewBlock label="Output" value={outputPreview} />
        {errorMessage ? (
          <PreviewBlock label="Error" value={errorMessage} />
        ) : null}
        <details className="rounded-md border border-border/60 bg-muted/20">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold">
            Raw JSON
          </summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-border/60 bg-background p-3 text-xs leading-5 [overflow-wrap:anywhere]">
            {JSON.stringify(node.detail, null, 2)}
          </pre>
        </details>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {node.eventId ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/debug/logs/${node.eventId}`}>
              {t("actions.openDebugLog")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard/session/overview">관련 세션</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/debug/reproduce">재현하기</Link>
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => copyNode(node)}
        >
          <Clipboard className="size-3.5" />
          복사
        </Button>
      </div>
    </DashboardPanel>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function PreviewBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function Legend({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "warning" | "bad";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`size-2 rounded-sm ${legendClass(tone)}`} />
      {label}
    </span>
  );
}

function getDefaultSelectedNodeId(timeline: SessionTimelineResponseDto) {
  return (
    timeline.nodes.find((node) => node.id === timeline.failedNodeId)?.id ??
    timeline.nodes.find((node) => node.status === "error")?.id ??
    timeline.nodes.find((node) => node.status === "warning")?.id ??
    timeline.nodes[0]?.id
  );
}

function buildTimelineLayout(nodes: SessionFlowNodeDto[]) {
  const nextXByLane = new Map<number, number>();
  const laidOutNodes = nodes.map((node, index) => {
    const laneIndex = laneIndexForNode(node);
    const baseX = FLOW_LEFT_OFFSET + index * (FLOW_NODE_WIDTH + FLOW_NODE_GAP);
    const x = Math.max(baseX, nextXByLane.get(laneIndex) ?? FLOW_LEFT_OFFSET);
    nextXByLane.set(laneIndex, x + FLOW_NODE_WIDTH + FLOW_NODE_GAP);

    return {
      node,
      x,
      y: FLOW_TOP_OFFSET + laneIndex * FLOW_LANE_HEIGHT + 13,
    };
  });
  const maxNodeX = laidOutNodes.reduce(
    (max, item) => Math.max(max, item.x + FLOW_NODE_WIDTH),
    FLOW_LEFT_OFFSET,
  );

  return {
    lanes: FLOW_LANES,
    laneHeight: FLOW_LANE_HEIGHT,
    width: Math.max(980, maxNodeX + 120),
    height: FLOW_TOP_OFFSET + FLOW_LANES.length * FLOW_LANE_HEIGHT + 28,
    nodes: laidOutNodes,
  };
}

function laneIndexForNode(node: SessionFlowNodeDto) {
  if (node.type === "user_input" || node.type === "prompt_build") return 0;
  if (
    node.type === "context_load" ||
    node.type === "memory_read" ||
    node.type === "memory_write"
  ) {
    return 1;
  }
  if (node.type === "llm_call") return 2;
  if (
    node.type === "tool_call" ||
    node.type === "guardrail_check" ||
    node.type === "retry"
  ) {
    return 3;
  }
  return 4;
}

function nodeIcon(type: SessionFlowNodeDto["type"]) {
  if (type === "user_input") return MessageSquare;
  if (
    type === "context_load" ||
    type === "memory_read" ||
    type === "memory_write"
  ) {
    return Database;
  }
  if (type === "llm_call") return Bot;
  if (type === "tool_call") return Wrench;
  if (type === "guardrail_check") return ShieldAlert;
  if (type === "retry") return RefreshCcw;
  if (type === "error") return OctagonAlert;
  if (type === "final_response") return CheckCircle2;
  return CircleDot;
}

function readDetailString(detail: Record<string, unknown>, key: string) {
  const value = detail[key];
  return typeof value === "string" ? value : undefined;
}

function copyNode(node: SessionFlowNodeDto) {
  if (typeof navigator === "undefined") return;
  void navigator.clipboard?.writeText(JSON.stringify(node, null, 2));
}

function formatNumber(value?: number | null) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCost(value?: number | null) {
  if (typeof value !== "number") return "-";
  return `$${value.toFixed(3)}`;
}

function formatMs(value?: number | null) {
  if (typeof value !== "number") return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatNodeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function iconToneClass(tone: "neutral" | "warning" | "bad") {
  if (tone === "bad") return "bg-rose-50 text-rose-700";
  if (tone === "warning") return "bg-amber-50 text-amber-700";
  return "bg-muted text-muted-foreground";
}

function nodeSurfaceClass(tone: "neutral" | "warning" | "bad") {
  if (tone === "bad") {
    return "border-l-rose-300";
  }
  if (tone === "warning") {
    return "border-l-amber-300";
  }
  return "border-l-border";
}

function legendClass(tone: "neutral" | "warning" | "bad") {
  if (tone === "bad") return "bg-rose-400";
  if (tone === "warning") return "bg-amber-400";
  return "bg-muted-foreground/40";
}
