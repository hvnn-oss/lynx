"use client";

import { CardSkeleton } from "../shared/skeletons";
import { MetricCard } from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardStatusData } from "@/hooks/pages/use-dashboard-section-data";

export function AgentStatus() {
  const query = useDashboardStatusData(["dashboard.status.agents"]);

  if (query.isLoading || !query.data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const status = query.data.agentStatus;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="정상" value={`${status.healthy}개`} tone="good" />
      <MetricCard label="주의" value={`${status.warning}개`} tone="warning" />
      <MetricCard label="위험" value={`${status.critical}개`} tone="bad" />
      <MetricCard label="오프라인" value={`${status.offline}개`} />
    </div>
  );
}
