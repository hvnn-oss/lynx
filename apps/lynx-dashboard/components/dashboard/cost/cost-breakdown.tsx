"use client";

import { ChartSkeleton } from "../shared/skeletons";
import { PiePanel } from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardCostData } from "@/hooks/pages/use-dashboard-section-data";

export function CostBreakdown() {
  const query = useDashboardCostData(["dashboard.cost.breakdown"]);

  if (query.isLoading || !query.data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  return (
    <PiePanel
      data={[
        { name: "모델", cost: query.data.costBreakdown.model },
        { name: "도구", cost: query.data.costBreakdown.tool },
        { name: "저장소", cost: query.data.costBreakdown.storage },
      ]}
      dataKey="cost"
      nameKey="name"
      label="비용"
      colors={["#2563eb", "#0f766e", "#f59e0b"]}
      valueFormatter={(value) => `$${Number(value).toFixed(2)}`}
    />
  );
}
