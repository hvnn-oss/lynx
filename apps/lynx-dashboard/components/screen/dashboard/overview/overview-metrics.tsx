import {
  DashboardMetricCard,
  DashboardMetricGrid,
} from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";
import {
  formatCost,
  formatLatency,
  type OverviewSummary,
} from "./overview-model";

export function OverviewMetrics({ summary }: { summary: OverviewSummary }) {
  const t = useTranslations("dashboard.overview.metrics");
  const sampleDescription = summary.isRunListCapped
    ? t("sample.capped")
    : t("sample.count", { count: summary.runCount });

  return (
    <DashboardMetricGrid>
      <DashboardMetricCard
        label={t("runs.label")}
        value={summary.runCount.toLocaleString()}
        description={sampleDescription}
      />
      <DashboardMetricCard
        label={t("failureRate.label")}
        value={`${summary.failureRate.toFixed(1)}%`}
        description={t("failureRate.description", {
          failed: summary.failedRunCount,
          terminal: summary.terminalRunCount,
        })}
        tone={summary.failedRunCount > 0 ? "bad" : "good"}
      />
      <DashboardMetricCard
        label={t("latency.label")}
        value={formatLatency(summary.p95LatencyMs)}
        description={t("latency.description")}
        tone={summary.p95LatencyMs === null ? "neutral" : "good"}
      />
      <DashboardMetricCard
        label={t("cost.label")}
        value={formatCost(summary.totalCost)}
        description={sampleDescription}
      />
      <DashboardMetricCard
        label={t("riskEvents.label")}
        value={summary.riskEventCount.toLocaleString()}
        description={t("riskEvents.description")}
        tone={summary.riskEventCount > 0 ? "bad" : "good"}
      />
    </DashboardMetricGrid>
  );
}
