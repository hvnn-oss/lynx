"use client";

import type { DashboardHomeMetricsDto } from "@repo/dto";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, GitBranch, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { FailureTrend } from "@/components/dashboard/home/failure-trend";
import { HealthScore } from "@/components/dashboard/home/health-score";
import { KpiCards } from "@/components/dashboard/home/kpi-cards";
import { RecentIssues } from "@/components/dashboard/home/recent-issues";
import { RunVolume } from "@/components/dashboard/home/run-volume";
import NoDataScreen from "@/components/layouts/dashboard/no-data";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardHomeData } from "@/hooks/pages/use-dashboard-home-data";
import { cn } from "@/lib/utils";
import { RelatedInvestigationPanel } from "@/components/investigation/related-investigation";

export function DashboardHomeView() {
  const t = useTranslations("dashboard.home");
  const breadcrumbT = useTranslations("dashboard.breadcrumbs");
  const { query, data } = useDashboardHomeData();
  const isEmpty = data ? isEmptyHomeData(data) : false;

  if (!query.isLoading && !runtimeConfig.demoMode && isEmpty) {
    return (
      <main>
        <UsePageInfo
          breadcrumbs={[
            { title: breadcrumbT("workspace"), url: "/workspaces/select" },
            { title: breadcrumbT("production"), url: "/dashboard" },
            { title: breadcrumbT("dashboard"), url: "/dashboard" },
          ]}
        />
        <NoDataScreen />
      </main>
    );
  }

  return (
    <main className="space-y-5 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("workspace"), url: "/workspaces/select" },
          { title: breadcrumbT("production"), url: "/dashboard" },
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
        ]}
      />

      <div className="flex flex-col gap-5">
        <DashboardPageHeader
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? (
                <DashRing className="size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {t("refresh")}
            </Button>
          }
          badge={
            runtimeConfig.demoMode ? (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                {t("demoData")}
              </span>
            ) : null
          }
          description={t("description")}
          title={t("title")}
        />

        {query.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {t("loadError")}
          </div>
        ) : null}

        <IncidentInsight data={data} isLoading={query.isLoading} />

        <DashboardInvestigationEntry data={data} isLoading={query.isLoading} />

        <KpiCards data={data?.kpis} isLoading={query.isLoading} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <DashboardSection title={t("sections.runVolume")}>
            <RunVolume data={data?.runVolume} isLoading={query.isLoading} />
          </DashboardSection>
          <DashboardSection title={t("sections.failureTrend")}>
            <FailureTrend
              data={data?.failureTrend}
              isLoading={query.isLoading}
            />
          </DashboardSection>
        </div>

        <DashboardSection title={t("sections.agentStatus")}>
          <HealthScore data={data?.healthScores} isLoading={query.isLoading} />
        </DashboardSection>

        <DashboardSection title={t("sections.recentIssues")}>
          <RecentIssues data={data?.recentIssues} isLoading={query.isLoading} />
        </DashboardSection>
      </div>
    </main>
  );
}

function DashboardInvestigationEntry({
  data,
  isLoading,
}: {
  data?: DashboardHomeMetricsDto;
  isLoading: boolean;
}) {
  const t = useTranslations("dashboard.home.investigation");

  if (isLoading || !data || isEmptyHomeData(data)) {
    return null;
  }

  const issue = data.recentIssues[0];
  const agent =
    data.healthScores.find((item) => item.agentName === issue?.agentName) ??
    data.healthScores[0];
  const agentId = agent?.agentId;
  const issueType = issue?.issueType;

  return (
    <RelatedInvestigationPanel
      description={t("description")}
      items={[
        {
          label: t("overall"),
          value: `${data.kpis.agentRuns.value.toLocaleString("ko-KR")} runs`,
          href: "/dashboard/metrics",
        },
        {
          label: t("sessions"),
          value: issue
            ? `${issue.affectedSessionsCount ?? 0} affected`
            : "전체 세션",
          href: agentId
            ? `/dashboard/session/failed?agentId=${agentId}`
            : "/dashboard/session/failed",
        },
        {
          label: t("agents"),
          value: issue?.agentName ?? agent?.agentName ?? "전체 에이전트",
          href: agentId ? `/agents/${agentId}` : "/agents",
        },
        {
          label: t("debug"),
          value: issueType ?? "조사 시작",
          href: issueType
            ? `/debug/errors?errorType=${encodeURIComponent(issueType)}`
            : "/debug/logs",
        },
      ]}
      actions={[
        {
          label: t("openSessions"),
          href: agentId
            ? `/dashboard/session/failed?agentId=${agentId}`
            : "/dashboard/session/failed",
        },
        {
          label: t("openAgents"),
          href: agentId ? `/agents/${agentId}` : "/agents",
        },
        {
          label: t("openErrors"),
          href: issueType
            ? `/debug/errors?errorType=${encodeURIComponent(issueType)}`
            : "/debug/errors",
        },
        {
          label: t("openPatterns"),
          href: agentId
            ? `/debug/failure-patterns?agentId=${agentId}`
            : "/debug/failure-patterns",
        },
      ]}
    />
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col">
      <h2 className="mb-3 text-lg font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  );
}

function IncidentInsight({
  data,
  isLoading,
}: {
  data?: DashboardHomeMetricsDto;
  isLoading: boolean;
}) {
  const t = useTranslations("dashboard.home.insight");

  if (isLoading || !data) {
    return null;
  }

  const hasRuns = data.kpis.agentRuns.value > 0;
  const issue = data.recentIssues[0];
  const failureRate = hasRuns
    ? Math.max(0, 100 - data.kpis.successRate.value)
    : 0;
  const failureRateChange = Math.max(0, -data.kpis.successRate.change);
  const showInsight =
    hasRuns &&
    (data.kpis.criticalAlerts.value > 0 || failureRateChange > 0 || !!issue);

  if (!showInsight) {
    return null;
  }

  const affectedSessions =
    issue?.affectedSessionsCount ??
    data.recentIssues.reduce(
      (sum, current) => sum + (current.affectedSessionsCount ?? 1),
      0,
    );
  const hasRisk = data.kpis.criticalAlerts.value > 0 || failureRate >= 5;
  const agentName = issue?.agentName ?? t("fallbackAgent");
  const issueType = issue?.issueType ?? t("fallbackIssue");

  return (
    <section
      className={cn(
        "rounded-lg border p-5",
        hasRisk
          ? "border-rose-200 bg-rose-50/60"
          : "border-amber-200 bg-amber-50/60",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border bg-white",
              hasRisk
                ? "border-rose-200 text-rose-700"
                : "border-amber-200 text-amber-700",
            )}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                hasRisk ? "text-rose-800" : "text-amber-800",
              )}
            >
              {t("label")}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-normal text-foreground">
              {t("title", {
                agentName,
                change: formatPercentPoint(failureRateChange),
              })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("description", {
                issueType,
                affectedSessions,
                failureRate: `${failureRate.toFixed(1)}%`,
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm">
            {t("rootCause")}
            <ArrowRight className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm">
            <GitBranch className="size-3.5" />
            {t("sessions")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function formatPercentPoint(value: number) {
  if (value <= 0) return "0.0%p";
  return `+${value.toFixed(1)}%p`;
}

function isEmptyHomeData(data: DashboardHomeMetricsDto): boolean {
  return (
    data.kpis.agentRuns.value === 0 &&
    data.kpis.activeAgents.value === 0 &&
    data.kpis.criticalAlerts.value === 0 &&
    data.healthScores.length === 0 &&
    data.runVolume.length === 0 &&
    data.failureTrend.length === 0 &&
    data.recentIssues.length === 0
  );
}
