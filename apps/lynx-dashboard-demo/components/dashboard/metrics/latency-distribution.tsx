"use client";

import { ChartSkeleton } from "../shared/skeletons";
import {
  BarPanel,
  numberFormatter,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardMetricsData } from "@/hooks/pages/use-dashboard-section-data";

export function LatencyDistribution() {
  const query = useDashboardMetricsData(["dashboard.metrics.latency"]);

  if (query.isLoading || !query.data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  const data = [
    { name: "p50", latency: query.data.latencyDistribution.p50 },
    { name: "p95", latency: query.data.latencyDistribution.p95 },
    { name: "p99", latency: query.data.latencyDistribution.p99 },
  ];

  return (
    <div className="space-y-3">
      <BarPanel
        data={data}
        dataKey="latency"
        nameKey="name"
        label="지연 시간"
        color="#0f766e"
        valueFormatter={(value) => `${numberFormatter.format(Number(value))}ms`}
      />
      <p className="text-xs text-muted-foreground">
        p95 {numberFormatter.format(query.data.latencyDistribution.p95)}ms 기준
      </p>
    </div>
  );
}
