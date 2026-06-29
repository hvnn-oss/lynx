"use client";

import { CardSkeleton } from "../shared/skeletons";
import {
  compactFormatter,
  MetricCard,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardMetricsData } from "@/hooks/pages/use-dashboard-section-data";

export function RunMetrics() {
  const query = useDashboardMetricsData(["dashboard.metrics.run"]);

  if (query.isLoading || !query.data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const { runMetrics } = query.data;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MetricCard
        label="초당 실행 수"
        value={runMetrics.runsPerSec.toFixed(1)}
        description="최근 집계 기준"
        tone="good"
      />
      <MetricCard
        label="초당 토큰 수"
        value={compactFormatter.format(runMetrics.tokensPerSec)}
        description="입력과 출력 토큰 합산"
      />
      <MetricCard
        label="초당 요청 수"
        value={runMetrics.requestsPerSec.toFixed(1)}
        description="SDK 이벤트 수신량"
      />
    </div>
  );
}
