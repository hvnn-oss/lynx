"use client";

import { DashboardAreaChart } from "@/components/ui/dashboard/area-chart";
import {
  DashboardChartPanel,
  DashboardSectionHeader,
} from "@repo/ui/components/dashboard/panel";
import type { ChartConfig } from "@repo/ui/components/ui/chart";
import { useTranslations } from "next-intl";
import type { OverviewTrendBucket } from "./overview-model";

export function OverviewTrends({ trend }: { trend: OverviewTrendBucket[] }) {
  const t = useTranslations("dashboard.overview.trends");
  const runChartConfig = {
    runs: {
      label: t("runVolume.series"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;
  const failureChartConfig = {
    failureRate: {
      label: t("failure.series"),
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;
  const hasRuns = trend.some((bucket) => bucket.runs > 0);

  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("title")}
        description={t("description")}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardChartPanel empty={!hasRuns} emptyText={t("empty")}>
          <div>
            <ChartHeading
              title={t("runVolume.title")}
              description={t("runVolume.description")}
            />
            <DashboardAreaChart
              categoryKey="date"
              className="mt-5 h-64"
              chartConfig={runChartConfig}
              chartData={trend}
              curveType="monotone"
              gradient
              tickFormatter={(value) => value.slice(5)}
            />
          </div>
        </DashboardChartPanel>
        <DashboardChartPanel empty={!hasRuns} emptyText={t("empty")}>
          <div>
            <ChartHeading
              title={t("failure.title")}
              description={t("failure.description")}
            />
            <DashboardAreaChart
              categoryKey="date"
              className="mt-5 h-64"
              chartConfig={failureChartConfig}
              chartData={trend}
              curveType="monotone"
              gradient
              tickFormatter={(value) => value.slice(5)}
            />
          </div>
        </DashboardChartPanel>
      </div>
    </section>
  );
}

function ChartHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
