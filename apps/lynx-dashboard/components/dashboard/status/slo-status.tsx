"use client";

import { CardSkeleton } from "../shared/skeletons";
import { MetricCard } from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardStatusData } from "@/hooks/pages/use-dashboard-section-data";

export function SloStatus() {
  const query = useDashboardStatusData(["dashboard.status.slo"]);

  if (query.isLoading || !query.data) {
    return <CardSkeleton className="w-full" rows={3} />;
  }

  const { slo } = query.data;

  return (
    <MetricCard
      label={slo.metricName}
      value={`${slo.current.toFixed(1)}%`}
      description={`목표 ${slo.target.toFixed(1)}%`}
      tone={slo.status === "COMPLIANT" ? "good" : "bad"}
    />
  );
}
