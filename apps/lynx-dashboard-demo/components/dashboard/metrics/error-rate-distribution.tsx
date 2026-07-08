"use client";

import { ListSkeleton } from "../shared/skeletons";
import {
  ListPanel,
  ListRow,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardMetricsData } from "@/hooks/pages/use-dashboard-section-data";

export function ErrorRateDistribution() {
  const query = useDashboardMetricsData(["dashboard.metrics.errors"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={3} />;
  }

  const rows = [
    { title: "Tool 오류", value: query.data.errorRate.toolError },
    { title: "LLM 오류", value: query.data.errorRate.llmError },
    { title: "검증 오류", value: query.data.errorRate.validationError },
  ];

  return (
    <ListPanel empty={rows.every((row) => row.value === 0)}>
      {rows.map((row, index) => (
        <div key={row.title}>
          <ListRow
            title={row.title}
            description="전체 실행 대비 비율"
            value={`${row.value.toFixed(1)}%`}
            tone={row.value >= 5 ? "bad" : row.value > 0 ? "warning" : "good"}
            markerClassName={
              row.value >= 5
                ? "bg-rose-500"
                : row.value > 0
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }
          />
          {index < rows.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
