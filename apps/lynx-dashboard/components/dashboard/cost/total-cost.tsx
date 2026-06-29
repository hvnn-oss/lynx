"use client";

import { CardSkeleton } from "../shared/skeletons";
import {
  currencyFormatter,
  MetricCard,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardCostData } from "@/hooks/pages/use-dashboard-section-data";

export function TotalCost() {
  const query = useDashboardCostData(["dashboard.cost.total"]);

  if (query.isLoading || !query.data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const { totalCost } = query.data;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MetricCard label="오늘" value={currencyFormatter.format(totalCost.today)} />
      <MetricCard
        label="이번 주"
        value={currencyFormatter.format(totalCost.thisWeek)}
      />
      <MetricCard
        label="이번 달"
        value={currencyFormatter.format(totalCost.thisMonth)}
      />
    </div>
  );
}
