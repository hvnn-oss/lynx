"use client";

import { ListSkeleton } from "../shared/skeletons";
import {
  BarPanel,
  compactFormatter,
  getCappedItems,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardUsageData } from "@/hooks/pages/use-dashboard-section-data";

const TOOL_USAGE_LIMIT = 8;

export function ToolUsage() {
  const query = useDashboardUsageData(["dashboard.usage.tools"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={4} />;
  }

  const { items } = getCappedItems(query.data.toolUsage, TOOL_USAGE_LIMIT);

  return (
    <BarPanel
      data={items.map((tool) => ({
        name: tool.name,
        count: tool.count,
      }))}
      dataKey="count"
      nameKey="name"
      label="호출 수"
      color="#2563eb"
      valueFormatter={(value) => `${compactFormatter.format(Number(value))}회`}
    />
  );
}
