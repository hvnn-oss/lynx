"use client";

import { ChartSkeleton } from "../shared/skeletons";
import { PiePanel } from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardMetricsData } from "@/hooks/pages/use-dashboard-section-data";

export function TokenMetrics() {
  const query = useDashboardMetricsData(["dashboard.metrics.tokens"]);

  if (query.isLoading || !query.data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  return (
    <PiePanel
      data={[
        { name: "입력", tokens: query.data.tokenMetrics.inputTokens },
        { name: "출력", tokens: query.data.tokenMetrics.outputTokens },
      ]}
      dataKey="tokens"
      nameKey="name"
      label="토큰"
      colors={["#2563eb", "#14b8a6"]}
      valueFormatter={(value) => `${Number(value).toLocaleString("ko-KR")} tokens`}
    />
  );
}
