"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  formatShortDate,
  getCappedItems,
  ListPanel,
  ListRow,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardCostData } from "@/hooks/pages/use-dashboard-section-data";

const COST_ANOMALY_LIMIT = 5;

export function CostAnomaly() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardCostData(["dashboard.cost.anomaly"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="w-full" rows={3} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.costAnomalies,
    COST_ANOMALY_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.costAnomalies.length === 0}
      emptyText={t("noCostAnomalyData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "비용 이상 신호",
          })}
        />
      }
    >
      {items.map((anomaly, index) => (
        <div key={`${anomaly.model}-${anomaly.timestamp}`}>
          <Link href={`/dashboard/cost/anomalies/${index}`}>
            <ListRow
              title={anomaly.model}
              description={`${formatShortDate(anomaly.timestamp)} · ${anomaly.description}`}
              value={`+${anomaly.percentageIncrease.toFixed(1)}%`}
              tone="bad"
              markerClassName="bg-rose-500"
            />
          </Link>
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
