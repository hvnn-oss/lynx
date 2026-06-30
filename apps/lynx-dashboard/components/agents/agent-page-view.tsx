"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  Gauge,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import {
  DashboardMetricCard,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import type {
  AgentIssueBadgeDto,
  AgentListItemDto,
  AgentListQueryDto,
  AgentPageKind,
  AgentStatus,
} from "@repo/dto";
import { runtimeConfig } from "@/config/runtime";
import { useAgentsQuery } from "@/hooks/queries/agent";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { getDemoAgentList } from "@/services/agent-demo-fixtures";

export type AgentViewKind = AgentPageKind;

type AgentFilterKey =
  | "status"
  | "agent"
  | "agentId"
  | "environment"
  | "group"
  | "model"
  | "tool"
  | "search";

interface AgentFilterToken {
  id: string;
  key: AgentFilterKey;
  value: string;
  label: string;
}

const AGENT_BASE_PATH = "/agents";

export function AgentPageView({ kind }: { kind: AgentViewKind }) {
  const t = useTranslations("agent");
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const [filterInput, setFilterInput] = useState("");
  const [filters, setFilters] = useState<AgentFilterToken[]>([]);
  const query = useMemo(
    () => ({
      workspaceId,
      limit: getPageLimit(kind),
      ...toAgentQuery(filters),
    }),
    [filters, kind, workspaceId],
  );
  const agentsQuery = useAgentsQuery(kind, query);
  const data = runtimeConfig.demoMode
    ? getDemoAgentList(kind, query)
    : agentsQuery.data;
  const agents = data?.agents ?? [];
  const hasFilters = filters.length > 0;

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = parseFilterInput(filterInput);
    if (nextFilters.length === 0) return;
    setFilters((current) => mergeFilters(current, nextFilters));
    setFilterInput("");
  };

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label={t("summary.totalAgents")}
          value={formatNumber(data?.overview.totalAgents)}
        />
        <DashboardMetricCard
          description={t("summary.activeDescription")}
          label={t("summary.activeAgents")}
          tone="good"
          value={formatNumber(data?.overview.activeAgents)}
        />
        <DashboardMetricCard
          description={t("summary.riskDescription")}
          label={t("summary.riskAgents")}
          tone={data?.overview.criticalAgents ? "bad" : "good"}
          value={formatNumber(
            (data?.overview.criticalAgents ?? 0) +
              (data?.overview.warningAgents ?? 0),
          )}
        />
        <DashboardMetricCard
          label={t("summary.successRate")}
          tone="good"
          value={formatPercent(data?.overview.avgSuccessRate)}
        />
        <DashboardMetricCard
          label={t("summary.totalCost")}
          value={formatCost(data?.overview.totalCost)}
        />
      </div>

      <DashboardPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <AgentBadge
                label={data?.overview.topIssue ?? t("insight.noTopIssue")}
                tone={data?.overview.topIssue ? "warning" : "good"}
              />
              <AgentBadge
                label={data?.overview.topAgent ?? t("insight.noTopAgent")}
                tone="neutral"
              />
            </div>
            <p className="font-semibold tracking-normal">
              {t(`insight.${kind}.title`)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {data?.overview.recommendation ?? t(`insight.${kind}.description`)}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={agents[0] ? `${AGENT_BASE_PATH}/${agents[0].agentId}` : AGENT_BASE_PATH}>
              {t("actions.openPriorityAgent")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </DashboardPanel>

      <DashboardPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("filters.basic")}</p>
            <form
              className="mt-2 flex flex-col gap-2 sm:flex-row"
              onSubmit={handleFilterSubmit}
            >
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-9 w-full rounded-md border border-border/50 bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  onChange={(event) => setFilterInput(event.target.value)}
                  placeholder={t("filters.placeholder")}
                  value={filterInput}
                />
              </label>
              <Button size="sm" type="submit">
                <Plus className="size-3.5" />
                {t("filters.add")}
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("filters.help")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "status:active",
                "status:warning",
                "agent:ResearchBot",
                "env:production",
                "tool:slack",
              ].map((filter) => (
                <FilterChip key={filter}>{filter}</FilterChip>
              ))}
            </div>
          </div>
          <div className="lg:w-[420px]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{t("filters.active")}</p>
              {hasFilters ? (
                <button
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setFilters([])}
                  type="button"
                >
                  {t("filters.clear")}
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {hasFilters ? (
                filters.map((filter) => (
                  <ActiveFilterChip
                    key={filter.id}
                    filter={filter}
                    onRemove={() =>
                      setFilters((current) =>
                        current.filter((item) => item.id !== filter.id),
                      )
                    }
                  />
                ))
              ) : (
                <p className="text-xs leading-6 text-muted-foreground">
                  {t("filters.empty")}
                </p>
              )}
            </div>
          </div>
        </div>
      </DashboardPanel>

      {agents.length === 0 ? (
        <AgentEmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {agents.map((agent) => (
              <AgentListRow key={agent.agentId} agent={agent} kind={kind} />
            ))}
            {data?.page.total && data.page.total > agents.length ? (
              <p className="text-center text-xs text-muted-foreground">
                {t("list.remaining", {
                  count: data.page.total - agents.length,
                })}
              </p>
            ) : null}
          </div>
          <AgentSidePanel agents={agents} kind={kind} />
        </div>
      )}
    </div>
  );
}

function AgentListRow({
  agent,
  kind,
}: {
  agent: AgentListItemDto;
  kind: AgentViewKind;
}) {
  const t = useTranslations("agent");

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusBadge status={agent.status} />
            {agent.issueBadges.slice(0, 3).map((badge) => (
              <AgentIssueBadge
                key={`${agent.agentId}-${badge.type}`}
                badge={badge}
              />
            ))}
            {agent.issueBadges.length === 0 ? (
              <AgentBadge label={t("badges.normal")} tone="good" />
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Link
              className="truncate text-base font-semibold hover:underline"
              href={`${AGENT_BASE_PATH}/${agent.agentId}`}
            >
              {agent.name}
            </Link>
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {agent.description ?? t("list.noDescription")}
            </p>
            <p className="text-xs text-muted-foreground">
              {agent.environment ?? "-"} · {agent.defaultModel ?? "-"} ·{" "}
              {agent.lastRunAt ? formatTime(agent.lastRunAt) : t("list.neverRun")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5 xl:w-[620px]">
          <MiniMetric
            label={t("metrics.sessions24h")}
            value={formatNumber(agent.sessionCount24h)}
          />
          <MiniMetric
            label={t("metrics.successRate")}
            tone={(agent.successRate ?? 1) < 0.95 ? "warning" : "good"}
            value={formatPercent(agent.successRate)}
          />
          <MiniMetric
            label={t("metrics.latency")}
            value={formatMs(
              kind === "latency" ? agent.p95LatencyMs : agent.avgLatencyMs,
            )}
          />
          <MiniMetric
            label={t("metrics.cost")}
            value={formatCost(agent.totalCost)}
          />
          <MiniMetric
            label={t("metrics.tools")}
            value={formatNumber(agent.connectedToolCount)}
          />
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`${AGENT_BASE_PATH}/${agent.agentId}`}>
            {t("actions.openDetail")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </DashboardPanel>
  );
}

function AgentSidePanel({
  agents,
  kind,
}: {
  agents: AgentListItemDto[];
  kind: AgentViewKind;
}) {
  const t = useTranslations("agent");
  const priority = agents[0];
  const rows = agents.slice(0, 6);

  return (
    <div className="space-y-4">
      <DashboardPanel>
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-border/60 bg-muted/20 p-2">
            {getKindIcon(kind)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t("side.priorityTitle")}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {priority
                ? t("side.priorityDescription", { name: priority.name })
                : t("side.noPriority")}
            </p>
          </div>
        </div>
      </DashboardPanel>
      <DashboardPanel>
        <p className="text-sm font-semibold">{t("side.ranking")}</p>
        <div className="mt-3 space-y-3">
          {rows.map((agent) => (
            <div key={agent.agentId} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Link
                  className="truncate text-sm font-medium hover:underline"
                  href={`${AGENT_BASE_PATH}/${agent.agentId}`}
                >
                  {agent.name}
                </Link>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {getRankingValue(agent, kind)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${getRankingWidth(agent, kind)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
}

function AgentEmptyState() {
  const t = useTranslations("agent");
  return (
    <DashboardPanel>
      <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
        <Bot className="size-8 text-muted-foreground" />
        <p className="mt-4 text-lg font-semibold tracking-normal">
          {t("empty.title")}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("empty.description")}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="https://docs.lynxops.co">{t("empty.sdkGuide")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/session/overview">
              {t("empty.sessions")}
            </Link>
          </Button>
        </div>
      </div>
    </DashboardPanel>
  );
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const tone =
    status === "CRITICAL"
      ? "bad"
      : status === "WARNING"
        ? "warning"
        : status === "ACTIVE"
          ? "good"
          : "neutral";
  return <AgentBadge label={status} tone={tone} />;
}

function AgentIssueBadge({ badge }: { badge: AgentIssueBadgeDto }) {
  return <AgentBadge label={badge.label} tone={badge.tone} />;
}

function AgentBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "good" | "warning" | "bad";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${badgeClass(tone)}`}
    >
      {label}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "bad";
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${toneClass(tone)}`}>
        {value}
      </p>
    </div>
  );
}

function FilterChip({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs font-medium text-muted-foreground">
      <Search className="size-3" />
      {children}
    </span>
  );
}

function ActiveFilterChip({
  filter,
  onRemove,
}: {
  filter: AgentFilterToken;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs font-medium text-foreground">
      {filter.label}
      <button
        aria-label={`${filter.label} filter remove`}
        className="rounded-sm p-0.5 hover:bg-primary/10"
        onClick={onRemove}
        type="button"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function getKindIcon(kind: AgentViewKind) {
  if (kind === "cost") return <CircleDollarSign className="size-4" />;
  if (kind === "latency" || kind === "tokens") {
    return <Gauge className="size-4" />;
  }
  if (kind === "success-rate") return <ShieldAlert className="size-4" />;
  return <Sparkles className="size-4" />;
}

function getPageLimit(kind: AgentViewKind) {
  if (kind === "overview") return 10;
  if (kind === "tools" || kind === "saas" || kind === "history") return 10;
  return 12;
}

function getRankingValue(agent: AgentListItemDto, kind: AgentViewKind) {
  if (kind === "latency") return formatMs(agent.p95LatencyMs);
  if (kind === "tokens") return formatCompact(agent.totalTokens);
  if (kind === "success-rate") return formatPercent(agent.successRate);
  if (kind === "cost") return formatCost(agent.totalCost);
  return `${formatNumber(agent.sessionCount24h)} runs`;
}

function getRankingWidth(agent: AgentListItemDto, kind: AgentViewKind) {
  if (kind === "success-rate") return Math.max((agent.successRate ?? 0) * 100, 4);
  if (kind === "cost") return Math.min(agent.totalCost / 2, 100);
  if (kind === "latency") return Math.min((agent.p95LatencyMs ?? 0) / 180, 100);
  if (kind === "tokens") return Math.min(agent.totalTokens / 8000, 100);
  return Math.min(agent.sessionCount24h * 1.5, 100);
}

function parseFilterInput(input: string): AgentFilterToken[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const tokens: AgentFilterToken[] = [];
  const matchedRanges: Array<[number, number]> = [];
  const tokenPattern =
    /([a-zA-Z][\w-]*):(?:\{([^}]+)\}|"([^"]+)"|'([^']+)'|(\S+))/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(trimmed))) {
    const key = normalizeFilterKey(match[1]);
    const value = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
    if (!value.trim()) continue;

    matchedRanges.push([match.index, match.index + match[0].length]);
    tokens.push(createFilterToken(key ?? "search", key ? value : match[0]));
  }

  const freeText = removeMatchedRanges(trimmed, matchedRanges).trim();
  if (freeText) tokens.push(createFilterToken("search", freeText));
  return tokens;
}

function removeMatchedRanges(value: string, ranges: Array<[number, number]>) {
  if (ranges.length === 0) return value;
  let result = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    result += value.slice(cursor, start);
    cursor = end;
  }
  return `${result}${value.slice(cursor)}`.replace(/\s+/g, " ");
}

function normalizeFilterKey(key: string | undefined): AgentFilterKey | null {
  const normalized = key?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "status" || normalized === "state") return "status";
  if (normalized === "agent" || normalized === "agentname") return "agent";
  if (normalized === "agentid" || normalized === "agent-id") return "agentId";
  if (normalized === "env" || normalized === "environment") {
    return "environment";
  }
  if (normalized === "group" || normalized === "team") return "group";
  if (normalized === "model") return "model";
  if (normalized === "tool") return "tool";
  if (normalized === "q" || normalized === "search") return "search";
  return null;
}

function createFilterToken(
  key: AgentFilterKey,
  value: string,
): AgentFilterToken {
  const normalizedValue = value.trim();
  return {
    id: `${key}:${normalizedValue.toLowerCase()}`,
    key,
    value: normalizedValue,
    label: `${key}:${normalizedValue}`,
  };
}

function mergeFilters(
  current: AgentFilterToken[],
  next: AgentFilterToken[],
) {
  const nextKeys = new Set(next.map((filter) => filter.key));
  return [
    ...current.filter((filter) => !nextKeys.has(filter.key)),
    ...next,
  ].filter(
    (filter, index, filters) =>
      filters.findIndex((item) => item.id === filter.id) === index,
  );
}

function toAgentQuery(filters: AgentFilterToken[]) {
  const query: Partial<AgentListQueryDto> = {};
  for (const filter of filters) {
    if (filter.key === "status") {
      const status = normalizeAgentStatus(filter.value);
      if (status) query.status = status;
      continue;
    }
    query[filter.key] = filter.value;
  }
  return query;
}

function normalizeAgentStatus(value: string): AgentStatus | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "active" || normalized === "live") return "ACTIVE";
  if (normalized === "inactive" || normalized === "offline") return "INACTIVE";
  if (normalized === "warning" || normalized === "warn") return "WARNING";
  if (normalized === "critical" || normalized === "failed") return "CRITICAL";
  return null;
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

function toneClass(tone: "neutral" | "good" | "warning" | "bad") {
  if (tone === "good") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "bad") return "text-rose-700";
  return "";
}
