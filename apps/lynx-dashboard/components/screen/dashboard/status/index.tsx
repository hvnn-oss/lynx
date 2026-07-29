"use client";

import type {
  DashboardIngestionStatusResponseDto,
  IngestionHealthStatus,
} from "@repo/dto";
import {
  DashboardChartPanel,
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { OperationsBadge } from "@/components/ui/operations/status-badge";
import { useDashboardIngestionStatus } from "@/hooks/use-dashboard-ingestion-status";

const STATUS_CLASS: Record<IngestionHealthStatus, string> = {
  HEALTHY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DELAYED: "border-amber-200 bg-amber-50 text-amber-700",
  INACTIVE: "border-slate-300 bg-slate-100 text-slate-700",
  NO_DATA: "border-slate-200 bg-slate-50 text-slate-600",
};

export function DashboardStatusScreen() {
  const t = useTranslations("status.page");
  const format = useFormatter();
  const { data, hasWorkspace, isPending, isError, refetch } =
    useDashboardIngestionStatus();

  if (isPending) return <StatusLoading />;
  if (isError) {
    return (
      <StatusError
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!hasWorkspace || !data) {
    return (
      <div className="space-y-8 p-20">
        <DashboardPageHeader title={t("title")} description={t("subtitle")} />
        <DashboardPanel className="flex min-h-56 flex-col items-center justify-center text-center">
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            {t("empty.description")}
          </p>
        </DashboardPanel>
      </div>
    );
  }

  const lastStoredAt = data.lastStoredAt
    ? format.dateTime(new Date(data.lastStoredAt), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : t("metrics.lastStoredAt.none");

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader
        title={t("title")}
        description={t("subtitle")}
        badge={
          <OperationsBadge className={STATUS_CLASS[data.status]}>
            {t(`health.${data.status}.label`)}
          </OperationsBadge>
        }
      />

      <DashboardPanel>
        <h2 className="text-sm font-semibold">
          {t(`health.${data.status}.title`)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(`health.${data.status}.description`)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("window", { hours: data.window.hours })}
        </p>
      </DashboardPanel>

      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("metrics.lastStoredAt.label")}
          value={lastStoredAt}
          description={t("metrics.lastStoredAt.description")}
          tone={
            data.status === "INACTIVE" || data.status === "NO_DATA"
              ? "warning"
              : "neutral"
          }
        />
        <DashboardMetricCard
          label={t("metrics.storedEvents.label")}
          value={String(data.metrics.storedEvents)}
          description={t("metrics.storedEvents.description", {
            hours: data.window.hours,
          })}
        />
        <DashboardMetricCard
          label={t("metrics.activeRuns.label")}
          value={String(data.metrics.activeRuns)}
          description={t("metrics.activeRuns.description")}
        />
        <DashboardMetricCard
          label={t("metrics.activeAgents.label")}
          value={String(data.metrics.activeAgents)}
          description={t("metrics.activeAgents.description")}
        />
        <DashboardMetricCard
          label={t("metrics.storageDelay.label")}
          value={
            data.metrics.p95StorageDelayMs === null
              ? "-"
              : formatDelay(data.metrics.p95StorageDelayMs)
          }
          description={t("metrics.storageDelay.description")}
          tone={data.status === "DELAYED" ? "warning" : "neutral"}
        />
      </DashboardMetricGrid>

      <section className="grid gap-8 xl:grid-cols-[2fr_1fr]">
        <HourlyVolumeChart data={data} />
        <SourceList data={data} />
      </section>

      <EventTypeList data={data} />
    </div>
  );
}

function HourlyVolumeChart({
  data,
}: {
  data: DashboardIngestionStatusResponseDto;
}) {
  const t = useTranslations("status.page.volume");
  const format = useFormatter();
  const maximum = Math.max(
    1,
    ...data.hourlyVolume.map((bucket) => bucket.count),
  );

  return (
    <DashboardChartPanel
      empty={data.hourlyVolume.every((bucket) => bucket.count === 0)}
      emptyText={t("empty")}
    >
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
      <div className="mt-6 flex h-56 items-end gap-1">
        {data.hourlyVolume.map((bucket, index) => (
          <div
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            key={bucket.timestamp}
          >
            <span className="text-[10px] font-medium tabular-nums">
              {bucket.count}
            </span>
            <div
              className="w-full rounded-t-sm bg-blue-500"
              style={{
                height: `${Math.max(4, Math.round((bucket.count / maximum) * 160))}px`,
              }}
            />
            <span className="h-4 text-[10px] text-muted-foreground">
              {index % 4 === 0
                ? format.dateTime(new Date(bucket.timestamp), {
                    hour: "2-digit",
                  })
                : ""}
            </span>
          </div>
        ))}
      </div>
    </DashboardChartPanel>
  );
}

function SourceList({ data }: { data: DashboardIngestionStatusResponseDto }) {
  const t = useTranslations("status.page.sources");
  const format = useFormatter();

  return (
    <DashboardListPanel
      empty={data.sources.length === 0}
      emptyText={t("empty")}
    >
      <h2 className="px-2 pb-2 text-sm font-semibold">{t("title")}</h2>
      {data.sources.map((source) => (
        <DashboardListRow
          key={`${source.agentId}:${source.environment}`}
          title={source.agentName}
          description={t("description", {
            environment: source.environment,
            lastStoredAt: format.dateTime(new Date(source.lastStoredAt), {
              dateStyle: "short",
              timeStyle: "short",
            }),
          })}
          value={t("eventCount", { count: source.eventCount })}
        />
      ))}
    </DashboardListPanel>
  );
}

function EventTypeList({
  data,
}: {
  data: DashboardIngestionStatusResponseDto;
}) {
  const t = useTranslations("status.page.eventTypes");

  return (
    <DashboardListPanel
      empty={data.eventTypes.length === 0}
      emptyText={t("empty")}
    >
      <h2 className="px-2 pb-2 text-sm font-semibold">{t("title")}</h2>
      <div className="grid md:grid-cols-2">
        {data.eventTypes.map((eventType) => (
          <DashboardListRow
            key={eventType.eventType}
            title={eventType.eventType}
            value={t("eventCount", { count: eventType.count })}
          />
        ))}
      </div>
    </DashboardListPanel>
  );
}

function StatusLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <DashboardPanel>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </DashboardPanel>
      <DashboardMetricGrid>
        {Array.from({ length: 5 }, (_, index) => (
          <DashboardPanel key={index}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-32" />
          </DashboardPanel>
        ))}
      </DashboardMetricGrid>
      <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
        {Array.from({ length: 2 }, (_, index) => (
          <DashboardPanel key={index}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-56 w-full" />
          </DashboardPanel>
        ))}
      </div>
    </div>
  );
}

function StatusError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("status.page.error");

  return (
    <DashboardPanel className="flex min-h-56 flex-col items-center justify-center text-center">
      <p className="text-sm font-medium">{t("title")}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        {t("description")}
      </p>
      <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("action")}
      </Button>
    </DashboardPanel>
  );
}

function formatDelay(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  return `${(milliseconds / 1_000).toFixed(1)}s`;
}
