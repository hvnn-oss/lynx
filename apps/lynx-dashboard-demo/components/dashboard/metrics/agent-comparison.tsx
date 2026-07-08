"use client";

import { useTranslations } from "next-intl";
import { ListSkeleton } from "../shared/skeletons";
import {
  currencyFormatter,
  DashboardMoreRow,
  getCappedItems,
  ListPanel,
  ListRow,
  numberFormatter,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardMetricsData } from "@/hooks/pages/use-dashboard-section-data";

const AGENT_COMPARISON_LIMIT = 6;

export function AgentComparison() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardMetricsData(["dashboard.metrics.agents"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="w-full" rows={5} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.agentComparison,
    AGENT_COMPARISON_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.agentComparison.length === 0}
      emptyText={t("noAgentPerformanceData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "에이전트",
          })}
        />
      }
    >
      {items.map((agent, index) => (
        <div key={agent.agentName}>
          <ListRow
            title={agent.agentName}
            description={t("successRateWithP95", {
              successRate: agent.successRate.toFixed(1),
              p95Latency: numberFormatter.format(agent.p95Latency),
            })}
            value={currencyFormatter.format(agent.cost)}
            tone={agent.successRate >= 95 ? "good" : "warning"}
            markerClassName={
              agent.successRate >= 95 ? "bg-emerald-500" : "bg-amber-500"
            }
          />
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
