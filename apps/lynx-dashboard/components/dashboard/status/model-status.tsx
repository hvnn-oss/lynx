"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  getCappedItems,
  ListPanel,
  ListRow,
  numberFormatter,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardStatusData } from "@/hooks/pages/use-dashboard-section-data";

const MODEL_STATUS_LIMIT = 5;

export function ModelStatus() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardStatusData(["dashboard.status.models"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={4} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.modelStatus,
    MODEL_STATUS_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.modelStatus.length === 0}
      emptyText={t("noModelStatusData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "모델",
          })}
        />
      }
    >
      {items.map((model, index) => (
        <div key={model.model}>
          <Link href={`/dashboard/models/${encodeURIComponent(model.model)}`}>
            <ListRow
              title={model.model}
              description={t("avgLatencyMs", {
                value: numberFormatter.format(model.avgLatency),
              })}
              value={`${model.successRate.toFixed(1)}%`}
              tone={model.successRate >= 98 ? "good" : "warning"}
              markerClassName={
                model.successRate >= 98 ? "bg-emerald-500" : "bg-amber-500"
              }
            />
          </Link>
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
