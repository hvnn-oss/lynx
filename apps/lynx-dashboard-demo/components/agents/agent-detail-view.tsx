"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Bot, CheckCircle2 } from "lucide-react";
import {
  DashboardMetricCard,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import type {
  AgentBehaviorEventDto,
  AgentDetailResponseDto,
  AgentIssueBadgeDto,
  AgentSaasAccessItemDto,
  AgentToolUsageItemDto,
} from "@repo/dto";
import { runtimeConfig } from "@/config/runtime";
import { useAgentDetailQuery } from "@/hooks/queries/agent";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { getDemoAgentDetail } from "@/services/agent-demo-fixtures";
import { RelatedInvestigationPanel } from "@/components/investigation/related-investigation";

export function AgentDetailView({ agentId }: { agentId: string }) {
  const t = useTranslations("agent");
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const detailQuery = useAgentDetailQuery(agentId, { workspaceId });
  const detail = runtimeConfig.demoMode
    ? getDemoAgentDetail(agentId)
    : detailQuery.data;

  if (!workspaceId && !runtimeConfig.demoMode) {
    return (
      <DashboardPanel>
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("empty.workspace")}
        </p>
      </DashboardPanel>
    );
  }

  if (!detail) {
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
      <DashboardPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Bot className="size-5 text-muted-foreground" />
              <h2 className="truncate text-xl font-semibold tracking-normal">
                {detail.name}
              </h2>
              <StatusBadge status={detail.status} />
              {detail.issueBadges.slice(0, 3).map((badge) => (
                <IssueBadge key={badge.type} badge={badge} />
              ))}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {detail.description ?? t("list.noDescription")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {detail.environment ?? "-"} · {detail.defaultModel ?? "-"} ·{" "}
              {detail.version ?? "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/session/overview?agentId=${detail.agentId}`}>
                {t("actions.sessions")}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/debug/logs?agentId=${detail.agentId}`}>
                {t("actions.debug")}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label={t("metrics.sessions24h")}
          value={formatNumber(detail.sessionCount24h)}
        />
        <DashboardMetricCard
          label={t("metrics.successRate")}
          tone={(detail.successRate ?? 1) < 0.95 ? "warning" : "good"}
          value={formatPercent(detail.successRate)}
        />
        <DashboardMetricCard
          label={t("metrics.latency")}
          value={formatMs(detail.avgLatencyMs)}
        />
        <DashboardMetricCard
          label={t("metrics.cost")}
          value={formatCost(detail.totalCost)}
        />
        <DashboardMetricCard
          label={t("metrics.tokens")}
          value={formatCompact(detail.totalTokens)}
        />
      </div>

      <DashboardPanel>
        <p className="text-sm font-semibold">{t("detail.recommendations")}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {detail.recommendations.map((item) => (
            <div
              className="rounded-md border border-border/60 bg-muted/20 p-3"
              key={item.title}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">{item.title}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
              {item.href ? (
                <Link
                  className="mt-3 inline-flex text-xs font-medium hover:underline"
                  href={item.href}
                >
                  {t("actions.openRelated")}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </DashboardPanel>

      <RelatedInvestigationPanel
        description="이 에이전트에서 보이는 실패율, 도구 실패, 비용, 지연 신호를 세션과 디버깅 화면으로 이어서 확인합니다."
        items={[
          {
            label: "에이전트",
            value: detail.name,
            href: `/agents/${detail.agentId}`,
          },
          {
            label: "관련 세션",
            value: `${detail.totalSessions} sessions`,
            href: `/dashboard/session/overview?agentId=${detail.agentId}`,
          },
          {
            label: "주요 이슈",
            value: detail.primaryIssue ?? "정상",
            href: `/debug/failure-patterns?agentId=${detail.agentId}`,
          },
          {
            label: "주요 도구",
            value: detail.tools[0] ?? "도구 없음",
            href: detail.tools[0]
              ? `/debug/tool-calls?agentId=${detail.agentId}&toolName=${encodeURIComponent(detail.tools[0])}`
              : `/debug/tool-calls?agentId=${detail.agentId}`,
          },
        ]}
        actions={[
          {
            label: "View Sessions",
            href: `/dashboard/session/overview?agentId=${detail.agentId}`,
          },
          {
            label: "Tool Calls",
            href: `/debug/tool-calls?agentId=${detail.agentId}`,
          },
          {
            label: "Failure Patterns",
            href: `/debug/failure-patterns?agentId=${detail.agentId}`,
          },
          {
            label: "Cost Drivers",
            href: `/debug/llm-io?agentId=${detail.agentId}`,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecentSessions detail={detail} />
        <TrendPanel detail={detail} />
        <ToolUsage tools={detail.toolUsage} />
        <SaasAccess apps={detail.saasAccess} />
      </div>

      <BehaviorHistory events={detail.behaviorHistory} />
    </div>
  );
}

function RecentSessions({ detail }: { detail: AgentDetailResponseDto }) {
  const t = useTranslations("agent");
  return (
    <DashboardPanel>
      <p className="text-sm font-semibold">{t("detail.recentSessions")}</p>
      <div className="mt-3 divide-y divide-border/50">
        {detail.recentSessions.slice(0, 8).map((session) => (
          <div
            className="flex items-center justify-between gap-4 py-3"
            key={session.sessionId}
          >
            <div className="min-w-0">
              <Link
                className="truncate text-sm font-medium hover:underline"
                href={`/dashboard/session/${session.sessionId}`}
              >
                {session.runId}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {session.status} · {formatTime(session.startedAt)} ·{" "}
                {session.primaryIssue ?? t("badges.normal")}
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {formatMs(session.durationMs)}
            </span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function TrendPanel({ detail }: { detail: AgentDetailResponseDto }) {
  const t = useTranslations("agent");
  const points = detail.performance.successTrend.slice(-24);
  return (
    <DashboardPanel>
      <p className="text-sm font-semibold">{t("detail.successTrend")}</p>
      <div className="mt-4 flex h-48 items-end gap-1">
        {points.map((point) => (
          <div
            className="min-w-0 flex-1 rounded-t bg-foreground"
            key={point.timestamp}
            style={{ height: `${Math.max(point.value * 100, 4)}%` }}
            title={`${formatTime(point.timestamp)} · ${formatPercent(point.value)}`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("detail.successTrendDescription")}
      </p>
    </DashboardPanel>
  );
}

function ToolUsage({ tools }: { tools: AgentToolUsageItemDto[] }) {
  const t = useTranslations("agent");
  return (
    <DashboardPanel>
      <p className="text-sm font-semibold">{t("detail.toolUsage")}</p>
      <div className="mt-3 space-y-3">
        {tools.slice(0, 8).map((tool) => (
          <CompactRow
            description={`${formatPercent(tool.successRate)} · ${formatMs(
              tool.avgLatencyMs,
            )} · ${tool.sideEffect}`}
            key={tool.toolName}
            title={tool.toolName}
            value={`${formatNumber(tool.callCount)} calls`}
          />
        ))}
      </div>
    </DashboardPanel>
  );
}

function SaasAccess({ apps }: { apps: AgentSaasAccessItemDto[] }) {
  const t = useTranslations("agent");
  return (
    <DashboardPanel>
      <p className="text-sm font-semibold">{t("detail.saasAccess")}</p>
      <div className="mt-3 space-y-3">
        {apps.slice(0, 8).map((app) => (
          <CompactRow
            description={`${app.riskLevel} · write ${formatNumber(
              app.writeCount,
            )} · failed ${formatNumber(app.failureCount)}`}
            key={app.appName}
            title={app.appName}
            value={`${formatNumber(app.callCount)} calls`}
          />
        ))}
      </div>
    </DashboardPanel>
  );
}

function BehaviorHistory({ events }: { events: AgentBehaviorEventDto[] }) {
  const t = useTranslations("agent");
  return (
    <DashboardPanel>
      <p className="text-sm font-semibold">{t("detail.behaviorHistory")}</p>
      <div className="mt-3 divide-y divide-border/50">
        {events.slice(0, 10).map((event) => (
          <div className="flex items-start justify-between gap-4 py-3" key={event.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{event.eventType}</span>
                <span className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                  {event.severity}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {event.summary}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function CompactRow({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-muted/30">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "CRITICAL"
      ? "bad"
      : status === "WARNING"
        ? "warning"
        : status === "ACTIVE"
          ? "good"
          : "neutral";
  return <Badge label={status} tone={tone} />;
}

function IssueBadge({ badge }: { badge: AgentIssueBadgeDto }) {
  return <Badge label={badge.label} tone={badge.tone} />;
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "good" | "warning" | "bad";
}) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${badgeClass(tone)}`}>
      {label}
    </span>
  );
}

function formatNumber(value?: number | null) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCompact(value?: number | null) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("ko-KR", { notation: "compact" }).format(value);
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number") return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCost(value?: number | null) {
  if (typeof value !== "number") return "-";
  return `$${value.toFixed(2)}`;
}

function formatMs(value?: number | null) {
  if (typeof value !== "number") return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function badgeClass(tone: "neutral" | "good" | "warning" | "bad") {
  if (tone === "good") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "warning") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }
  if (tone === "bad") {
    return "border border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border border-border/60 bg-muted/40 text-muted-foreground";
}
