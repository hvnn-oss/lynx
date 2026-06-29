"use client";

import { ChartSkeleton } from "../shared/skeletons";
import {
  AreaPanel,
  formatShortDate,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardCostData } from "@/hooks/pages/use-dashboard-section-data";

export function CostPerRun() {
  const query = useDashboardCostData(["dashboard.cost.per-run"]);

  if (query.isLoading || !query.data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  return (
    <AreaPanel
      data={query.data.costPerRun.timeSeries.map((point) => ({
        date: formatShortDate(point.date),
        cost: point.avgCost,
      }))}
      dataKey="cost"
      nameKey="date"
      label="평균 비용"
      color="#0f766e"
      valueFormatter={(value) => `$${Number(value).toFixed(3)}`}
    />
  );
}
