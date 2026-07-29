"use client";

import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
} from "@repo/ui/components/dashboard/panel";
import { useFormatter, useTranslations } from "next-intl";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
  formatDuration,
} from "@/components/screen/dashboard/actual-data-page";
import {
  useDashboardAgentDetail,
  useDashboardSessionDetail,
} from "@/hooks/use-dashboard-operational-pages";

export function DashboardSessionDetailScreen({ id }: { id: string }) {
  const t = useTranslations("detailPages.session");
  const format = useFormatter();
  const { data, isPending, isError, refetch } = useDashboardSessionDetail(id);

  if (isPending) return <ActualDataPageLoading />;
  if (isError || !data)
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={t("title")}
        pageDescription={t("description")}
        action={t("error.action")}
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={data.sessionId}
        description={t("header", {
          agent: data.agent.name,
          startedAt: format.dateTime(new Date(data.startedAt), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard label={t("metrics.status")} value={data.status} />
        <DashboardMetricCard
          label={t("metrics.duration")}
          value={formatDuration(data.durationMs)}
        />
        <DashboardMetricCard
          label={t("metrics.runs")}
          value={String(data.runCount)}
        />
        <DashboardMetricCard
          label={t("metrics.tokens")}
          value={format.number(data.totalTokens)}
        />
        <DashboardMetricCard
          label={t("metrics.cost")}
          value={format.number(data.cost, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 4,
          })}
          description={t("metrics.issues", { count: data.issueCount })}
          tone={data.issueCount > 0 ? "warning" : "neutral"}
        />
      </DashboardMetricGrid>
      <DashboardListPanel
        empty={data.events.length === 0}
        emptyText={t("events.empty")}
        footer={
          data.hasMoreEvents ? (
            <p className="text-center text-xs text-muted-foreground">
              {t("events.more")}
            </p>
          ) : undefined
        }
      >
        <h2 className="px-2 pb-2 text-sm font-semibold">{t("events.title")}</h2>
        {data.events.map((event) => (
          <DashboardListRow
            key={event.id}
            title={event.label}
            description={t("events.description", {
              type: event.eventType,
              timestamp: format.dateTime(new Date(event.timestamp), {
                timeStyle: "medium",
              }),
            })}
            value={
              event.latency === null ? undefined : formatDuration(event.latency)
            }
          />
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function DashboardAgentDetailScreen({ id }: { id: string }) {
  const t = useTranslations("detailPages.agent");
  const format = useFormatter();
  const { data, isPending, isError, refetch } = useDashboardAgentDetail(id);

  if (isPending) return <ActualDataPageLoading />;
  if (isError || !data)
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={t("title")}
        pageDescription={t("description")}
        action={t("error.action")}
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader
        title={data.name}
        description={data.description ?? t("noDescription")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("metrics.runs")}
          value={String(data.metrics.runCount)}
        />
        <DashboardMetricCard
          label={t("metrics.completed")}
          value={String(data.metrics.completedRunCount)}
          tone="good"
        />
        <DashboardMetricCard
          label={t("metrics.failed")}
          value={String(data.metrics.failedRunCount)}
          tone={data.metrics.failedRunCount > 0 ? "bad" : "neutral"}
        />
        <DashboardMetricCard
          label={t("metrics.tokens")}
          value={format.number(data.metrics.totalTokens)}
        />
        <DashboardMetricCard
          label={t("metrics.cost")}
          value={format.number(data.metrics.totalCost, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 4,
          })}
          description={data.defaultModel}
        />
      </DashboardMetricGrid>
      <section className="grid gap-8 xl:grid-cols-2">
        <DashboardListPanel
          empty={data.recentRuns.length === 0}
          emptyText={t("runs.empty")}
        >
          <h2 className="px-2 pb-2 text-sm font-semibold">{t("runs.title")}</h2>
          {data.recentRuns.map((run) => (
            <DashboardListRow
              key={run.id}
              title={run.runId}
              description={format.dateTime(new Date(run.startedAt), {
                dateStyle: "short",
                timeStyle: "short",
              })}
              value={run.status}
              tone={run.status === "FAILED" ? "bad" : "neutral"}
            />
          ))}
        </DashboardListPanel>
        <DashboardListPanel
          empty={data.recentIssues.length === 0}
          emptyText={t("issues.empty")}
        >
          <h2 className="px-2 pb-2 text-sm font-semibold">
            {t("issues.title")}
          </h2>
          {data.recentIssues.map((issue) => (
            <DashboardListRow
              key={issue.id}
              title={issue.title}
              description={format.dateTime(new Date(issue.lastSeenAt), {
                dateStyle: "short",
                timeStyle: "short",
              })}
              value={issue.severity}
              tone={issue.severity === "CRITICAL" ? "bad" : "warning"}
            />
          ))}
        </DashboardListPanel>
      </section>
    </div>
  );
}
