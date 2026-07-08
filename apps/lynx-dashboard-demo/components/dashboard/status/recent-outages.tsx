"use client";

import { useTranslations } from "next-intl";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  formatShortDate,
  getCappedItems,
  ListPanel,
  ListRow,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardStatusData } from "@/hooks/pages/use-dashboard-section-data";

const RECENT_OUTAGE_LIMIT = 5;

export function RecentOutages() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardStatusData(["dashboard.status.outages"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="w-full" rows={3} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.recentOutages,
    RECENT_OUTAGE_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.recentOutages.length === 0}
      emptyText={t("noOutageData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "장애 기록",
          })}
        />
      }
    >
      {items.map((outage, index) => (
        <div key={`${outage.component}-${outage.timestamp}`}>
          <ListRow
            title={outage.component}
            description={outage.error}
            value={formatShortDate(outage.timestamp)}
            tone="bad"
            markerClassName="bg-rose-500"
          />
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
