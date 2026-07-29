import { DashboardMetricGrid } from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";
import {
  formatCost,
  formatLatency,
  type OverviewSummary,
} from "./overview-model";
import { KpiCard } from "./kpi-card";

export function OverviewMetrics({ summary }: { summary: OverviewSummary }) {
  const t = useTranslations("dashboard.overview.metrics");
  const sampleDescription = summary.isRunListCapped
    ? t("sample.capped")
    : t("sample.count", { count: summary.runCount });

  return (
    <DashboardMetricGrid>
      <KpiCard
        title={t("runs.label")}
        figure={summary.runCount}
        subtitle={sampleDescription}
      />
      <KpiCard
        title={t("failureRate.label")}
        figure={summary.failureRate.toFixed(1)}
        unit="%"
        subtitle={t("failureRate.description", {
          failed: summary.failedRunCount,
          terminal: summary.terminalRunCount,
        })}
        isRisky={summary.failureRate > 20}
      />
      <KpiCard
        title={t("latency.label")}
        figure={formatLatency(summary.p95LatencyMs)}
        subtitle={t("latency.description")}
        isRisky={!summary.p95LatencyMs === null}
      />
      <KpiCard
        title={t("cost.label")}
        figure={formatCost(summary.totalCost)}
        subtitle={sampleDescription}
      />
      <KpiCard
        title={t("riskEvents.label")}
        figure={summary.riskEventCount.toLocaleString()}
        subtitle={t("riskEvents.description")}
        isRisky={summary.riskEventCount > 0}
      />
    </DashboardMetricGrid>
  );
}
