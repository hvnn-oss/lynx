"use client";

import type {
  DashboardSessionScope,
  DashboardSessionsResponseDto,
} from "@repo/dto";
import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
} from "@repo/ui/components/dashboard/panel";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import {
  ActualDataBarChart,
  ActualDataPageLoading,
  ActualDataPageMessage,
  formatDuration,
} from "@/components/screen/dashboard/actual-data-page";
import { useDashboardSessions } from "@/hooks/use-dashboard-operational-pages";

const PAGE_KEY: Record<
  DashboardSessionScope,
  "overview" | "completed" | "failed"
> = {
  ALL: "overview",
  COMPLETED: "completed",
  FAILED: "failed",
};

export function DashboardSessionsScreen({
  scope,
}: {
  scope: DashboardSessionScope;
}) {
  const t = useTranslations("sessionsPage");
  const format = useFormatter();
  const pageKey = PAGE_KEY[scope];
  const { data, hasWorkspace, isPending, isError, refetch } =
    useDashboardSessions(scope);
  const pageTitle = t(`pages.${pageKey}.title`);
  const pageDescription = t(`pages.${pageKey}.description`);

  if (isPending) return <ActualDataPageLoading />;
  if (isError) {
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        action={t("error.action")}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!hasWorkspace || !data) {
    return (
      <ActualDataPageMessage
        title={t("empty.workspaceTitle")}
        description={t("empty.workspaceDescription")}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
      />
    );
  }

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader title={pageTitle} description={pageDescription} />
      <SessionMetrics data={data} />
      <section className="grid gap-8 xl:grid-cols-[1fr_1.2fr]">
        <SessionList data={data} />
        <ActualDataBarChart
          title={t("volume.title")}
          description={t("volume.description", {
            hours: data.window.hours,
          })}
          emptyText={t("volume.empty")}
          colorClassName={scope === "FAILED" ? "bg-rose-500" : "bg-emerald-500"}
          items={data.hourlyVolume.map((bucket, index) => ({
            key: bucket.timestamp,
            label:
              index % 4 === 0
                ? format.dateTime(new Date(bucket.timestamp), {
                    hour: "2-digit",
                  })
                : "",
            value: bucket.count,
          }))}
        />
      </section>
    </div>
  );
}

function SessionMetrics({ data }: { data: DashboardSessionsResponseDto }) {
  const t = useTranslations("sessionsPage.metrics");
  const format = useFormatter();

  return (
    <DashboardMetricGrid>
      <DashboardMetricCard
        label={t("sessions.label")}
        value={String(data.metrics.sessionCount)}
        description={t("sessions.description", {
          hours: data.window.hours,
        })}
      />
      <DashboardMetricCard
        label={t("completed.label")}
        value={String(data.metrics.completedCount)}
        description={t("completed.description")}
        tone="good"
      />
      <DashboardMetricCard
        label={t("failed.label")}
        value={String(data.metrics.failedCount)}
        description={t("failed.description")}
        tone={data.metrics.failedCount > 0 ? "bad" : "neutral"}
      />
      <DashboardMetricCard
        label={t("duration.label")}
        value={formatDuration(data.metrics.averageDurationMs)}
        description={t("duration.description", {
          elapsed: formatDuration(data.metrics.averageElapsedDurationMs),
        })}
      />
      <DashboardMetricCard
        label={t("cost.label")}
        value={format.number(data.metrics.averageCost, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 4,
        })}
        description={t("cost.description", {
          blocked: data.metrics.blockedCount,
        })}
        tone={data.metrics.blockedCount > 0 ? "warning" : "neutral"}
      />
    </DashboardMetricGrid>
  );
}

function SessionList({ data }: { data: DashboardSessionsResponseDto }) {
  const t = useTranslations("sessionsPage.list");
  const format = useFormatter();

  return (
    <DashboardListPanel
      empty={data.sessions.length === 0}
      emptyText={t("empty")}
    >
      <h2 className="px-2 pb-2 text-sm font-semibold">{t("title")}</h2>
      {data.sessions.map((session) => (
        <Link href={`/dashboard/session/detail/${session.id}`} key={session.id}>
          <DashboardListRow
            title={session.sessionId}
            description={t("description", {
              agent: session.agent.name,
              runs: session.runCount,
              activeDuration: formatDuration(session.durationMs),
              elapsedDuration: formatDuration(session.elapsedDurationMs),
              lastActivity: format.dateTime(
                new Date(session.lastActivityAt),
                {
                  dateStyle: "short",
                  timeStyle: "short",
                },
              ),
              cost: format.number(session.cost, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 4,
              }),
            })}
            value={t(`status.${readSessionStatus(session.status)}`)}
            tone={getSessionTone(session.status)}
          />
        </Link>
      ))}
    </DashboardListPanel>
  );
}

function readSessionStatus(
  status: string,
): "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "UNKNOWN" {
  if (
    status === "RUNNING" ||
    status === "COMPLETED" ||
    status === "FAILED" ||
    status === "CANCELLED"
  )
    return status;
  return "UNKNOWN";
}

function getSessionTone(
  status: string,
): "neutral" | "good" | "warning" | "bad" {
  if (status === "COMPLETED") return "good";
  if (status === "FAILED") return "bad";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}
