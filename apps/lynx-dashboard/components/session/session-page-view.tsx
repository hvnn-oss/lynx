"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, GitBranch, Plus, Search, X } from "lucide-react";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import type {
  SessionIssueBadgeDto,
  SessionListItemDto,
  SessionListQueryDto,
  SessionPageKind,
  SessionStatus,
} from "@repo/dto";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { useSessionsQuery } from "@/hooks/queries/session";
import { getDemoSessionList } from "@/services/session-demo-fixtures";

export type SessionViewKind = SessionPageKind;

const SESSION_BASE_PATH = "/dashboard/session";

type SessionFilterKey =
  | "status"
  | "agent"
  | "agentId"
  | "environment"
  | "sessionId"
  | "runId"
  | "traceId"
  | "search";

interface SessionFilterToken {
  id: string;
  key: SessionFilterKey;
  value: string;
  label: string;
}

export function SessionPageView({ kind }: { kind: SessionViewKind }) {
  const t = useTranslations("session");
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const [filterInput, setFilterInput] = useState("");
  const [filters, setFilters] = useState<SessionFilterToken[]>([]);
  const query = useMemo(
    () => ({
      workspaceId,
      limit: 25,
      ...toSessionQuery(filters),
    }),
    [filters, workspaceId],
  );
  const sessionsQuery = useSessionsQuery(kind, query);
  const data = runtimeConfig.demoMode
    ? getDemoSessionList(kind, query)
    : sessionsQuery.data;
  const sessions = data?.sessions ?? [];
  const hasFilters = filters.length > 0;

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = parseFilterInput(filterInput);
    if (nextFilters.length === 0) return;

    setFilters((current) => mergeFilters(current, nextFilters));
    setFilterInput("");
  };

  const removeFilter = (filterId: string) => {
    setFilters((current) => current.filter((filter) => filter.id !== filterId));
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
        <SessionSummaryCard
          label={t("summary.totalSessions")}
          value={formatNumber(data?.overview.totalSessions)}
        />
        <SessionSummaryCard
          label={t("summary.successRate")}
          tone="good"
          value={formatPercent(data?.overview.successRate)}
        />
        <SessionSummaryCard
          label={t("summary.failedSessions")}
          tone={data?.overview.failedSessions ? "bad" : "good"}
          value={formatNumber(data?.overview.failedSessions)}
        />
        <SessionSummaryCard
          label={t("summary.anomalySessions")}
          tone={data?.overview.anomalySessions ? "warning" : "good"}
          value={formatNumber(data?.overview.anomalySessions)}
        />
        <SessionSummaryCard
          label={t("summary.avgDuration")}
          value={formatMs(data?.overview.avgDurationMs)}
        />
      </div>

      <DashboardPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <SessionIssueBadge
                badge={{
                  label: data?.overview.topIssue ?? t("insight.noTopIssue"),
                  type: "top",
                  tone: data?.overview.topIssue ? "warning" : "good",
                }}
              />
              <SessionIssueBadge
                badge={{
                  label: data?.overview.topAgent ?? t("insight.noTopAgent"),
                  type: "agent",
                  tone: "neutral",
                }}
              />
            </div>
            <p className="font-semibold tracking-normal">
              {t(`insight.${kind}.title`)}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t(`insight.${kind}.description`)}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              href={
                sessions[0]
                  ? `${SESSION_BASE_PATH}/${sessions[0].sessionId}`
                  : `${SESSION_BASE_PATH}/overview`
              }
            >
              {t("actions.openFirstSession")}
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
                  className="h-9 w-full rounded-md border border-border/50 bg-background/70 pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
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
                "status:live",
                "status:failed",
                "agent:{ResearchBot}",
                "env:production",
                "trace:trace-3100",
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
                    onRemove={() => removeFilter(filter.id)}
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

      {sessions.length === 0 ? (
        <SessionEmptyState />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionListRow key={session.sessionId} session={session} />
          ))}
          {data?.page.total && data.page.total > sessions.length ? (
            <p className="text-center text-xs text-muted-foreground">
              {t("list.remaining", {
                count: data.page.total - sessions.length,
              })}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SessionListRow({ session }: { session: SessionListItemDto }) {
  const t = useTranslations("session");

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SessionStatusBadge
              status={session.status}
              severity={session.severity}
            />
            {session.issueBadges.slice(0, 3).map((badge) => (
              <SessionIssueBadge
                key={`${session.sessionId}-${badge.type}`}
                badge={badge}
              />
            ))}
            {session.issueBadges.length === 0 ? (
              <SessionIssueBadge
                badge={{
                  label: t("badges.normal"),
                  type: "normal",
                  tone: "good",
                }}
              />
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Link
              className="truncate text-base font-semibold hover:underline"
              href={`${SESSION_BASE_PATH}/${session.sessionId}`}
            >
              {session.runId}
            </Link>
            <p className="text-sm leading-6 text-muted-foreground">
              {session.agentName} · {formatTime(session.startedAt)} ·{" "}
              {session.rootCauseCandidate ?? t("list.noRootCause")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5 xl:w-[560px]">
          <MiniMetric label="LLM" value={`${session.llmCallCount}`} />
          <MiniMetric label="Tool" value={`${session.toolCallCount}`} />
          <MiniMetric
            label="Token"
            value={formatCompact(session.totalTokens)}
          />
          <MiniMetric label="Cost" value={formatCost(session.totalCost)} />
          <MiniMetric label="Latency" value={formatMs(session.durationMs)} />
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`${SESSION_BASE_PATH}/${session.sessionId}`}>
            {t("actions.openTimeline")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </DashboardPanel>
  );
}

export function SessionSummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "bad";
}) {
  return (
    <DashboardPanel>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-3 text-2xl font-semibold tabular-nums ${toneClass(tone)}`}
      >
        {value}
      </p>
    </DashboardPanel>
  );
}

export function SessionStatusBadge({
  status,
  severity,
}: {
  status: string;
  severity?: string;
}) {
  const tone =
    severity === "CRITICAL" || status === "FAILED" || status === "CANCELLED"
      ? "bad"
      : status === "RUNNING"
        ? "warning"
        : "good";
  return <Badge label={status} tone={tone} />;
}

export function SessionIssueBadge({ badge }: { badge: SessionIssueBadgeDto }) {
  return <Badge label={badge.label} tone={badge.tone} />;
}

function SessionEmptyState() {
  const t = useTranslations("session");
  return (
    <DashboardPanel>
      <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
        <GitBranch className="size-8 text-muted-foreground" />
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
            <Link href={`${SESSION_BASE_PATH}/demo-session-1`}>
              {t("empty.sampleSession")}
            </Link>
          </Button>
        </div>
      </div>
    </DashboardPanel>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
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
  filter: SessionFilterToken;
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

function Badge({
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

function parseFilterInput(input: string): SessionFilterToken[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const tokens: SessionFilterToken[] = [];
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
  if (freeText) {
    tokens.push(createFilterToken("search", freeText));
  }

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

function normalizeFilterKey(key: string | undefined): SessionFilterKey | null {
  const normalized = key?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "status" || normalized === "state") return "status";
  if (normalized === "agent" || normalized === "agentname") return "agent";
  if (normalized === "agentid" || normalized === "agent-id") return "agentId";
  if (normalized === "env" || normalized === "environment") {
    return "environment";
  }
  if (normalized === "session" || normalized === "sessionid") {
    return "sessionId";
  }
  if (normalized === "run" || normalized === "runid") return "runId";
  if (normalized === "trace" || normalized === "traceid") return "traceId";
  if (normalized === "q" || normalized === "search") return "search";
  return null;
}

function createFilterToken(
  key: SessionFilterKey,
  value: string,
): SessionFilterToken {
  const normalizedValue = value.trim();
  return {
    id: `${key}:${normalizedValue.toLowerCase()}`,
    key,
    value: normalizedValue,
    label: `${key}:${normalizedValue}`,
  };
}

function mergeFilters(
  current: SessionFilterToken[],
  next: SessionFilterToken[],
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

function toSessionQuery(filters: SessionFilterToken[]) {
  const query: Partial<SessionListQueryDto> = {};
  for (const filter of filters) {
    if (filter.key === "status") {
      const status = normalizeSessionStatus(filter.value);
      if (status) query.status = status;
      continue;
    }
    query[filter.key] = filter.value;
  }
  return query;
}

function normalizeSessionStatus(value: string): SessionStatus | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "live" || normalized === "running") return "RUNNING";
  if (normalized === "completed" || normalized === "success") {
    return "COMPLETED";
  }
  if (normalized === "failed" || normalized === "error") return "FAILED";
  if (normalized === "cancelled" || normalized === "canceled") {
    return "CANCELLED";
  }
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
  return `${Math.round(value * 100)}%`;
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
