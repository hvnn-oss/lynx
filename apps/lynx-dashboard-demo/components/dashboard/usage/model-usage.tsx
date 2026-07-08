"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ListSkeleton } from "../shared/skeletons";
import {
  compactFormatter,
  DashboardMoreRow,
  getCappedItems,
  ListPanel,
  ListRow,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardUsageData } from "@/hooks/pages/use-dashboard-section-data";

const MODEL_USAGE_LIMIT = 6;

export function ModelUsage() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardUsageData(["dashboard.usage.models"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={4} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.modelUsage,
    MODEL_USAGE_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.modelUsage.length === 0}
      emptyText={t("noModelUsageData")}
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
        <div key={model.name}>
          <Link href={`/dashboard/models/${encodeURIComponent(model.name)}`}>
            <ListRow
              title={model.name}
              description={t("callCount", {
                count: compactFormatter.format(model.count),
              })}
              value={`${compactFormatter.format(model.tokens)} tokens`}
              markerClassName="bg-violet-500"
            />
          </Link>
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
