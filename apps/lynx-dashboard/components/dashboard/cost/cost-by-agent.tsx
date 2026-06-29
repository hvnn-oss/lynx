"use client";

import { ChartSkeleton } from "../shared/skeletons";
import {
  BarPanel,
  currencyFormatter,
  getCappedItems,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardCostData } from "@/hooks/pages/use-dashboard-section-data";

const COST_BY_AGENT_LIMIT = 8;

export function CostByAgent() {
  const query = useDashboardCostData(["dashboard.cost.agents"]);

  if (query.isLoading || !query.data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  const { items } = getCappedItems(query.data.costByAgent, COST_BY_AGENT_LIMIT);

  return (
    <BarPanel
      data={items.map((agent) => ({
        name: agent.agentName,
        cost: agent.cost,
      }))}
      dataKey="cost"
      nameKey="name"
      label="비용"
      color="#2563eb"
      valueFormatter={(value) => currencyFormatter.format(Number(value))}
    />
  );
}
