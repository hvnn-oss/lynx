import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { AgentComparison } from "@/components/dashboard/metrics/agent-comparison";
import { ErrorRateDistribution } from "@/components/dashboard/metrics/error-rate-distribution";
import { LatencyDistribution } from "@/components/dashboard/metrics/latency-distribution";
import { RunMetrics } from "@/components/dashboard/metrics/run-metrics";
import { TokenMetrics } from "@/components/dashboard/metrics/token-metrics";
import { UsePageInfo } from "@/components/util/set-pageinfo";

export default async function MetricsPage() {
  const t = await getTranslations("dashboard.pages.metrics");
  const breadcrumbT = await getTranslations("dashboard.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: t("breadcrumb"), url: "/dashboard/metrics" },
        ]}
      />

      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          description={t("description")}
          title={t("title")}
        />

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">
            {t("sections.runMetrics")}
          </h2>
          <RunMetrics />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.latency")}
            </h2>
            <LatencyDistribution />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.tokens")}
            </h2>
            <TokenMetrics />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.errors")}
            </h2>
            <ErrorRateDistribution />
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">
            {t("sections.agentComparison")}
          </h2>
          <AgentComparison />
        </div>
      </div>
    </main>
  );
}
