"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  getCappedItems,
  ListPanel,
  ListRow,
  RowSeparator,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardStatusData } from "@/hooks/pages/use-dashboard-section-data";

const TOOL_STATUS_LIMIT = 5;

export function ToolStatus() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardStatusData(["dashboard.status.tools"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={4} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.toolStatus,
    TOOL_STATUS_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.toolStatus.length === 0}
      emptyText={t("noToolStatusData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "도구",
          })}
        />
      }
    >
      {items.map((tool, index) => (
        <div key={tool.tool}>
          <Link href={`/dashboard/tools/${encodeURIComponent(tool.tool)}`}>
            <ListRow
              title={tool.tool}
              description={t("toolSuccessRate")}
              value={`${tool.successRate.toFixed(1)}%`}
              tone={tool.successRate >= 98 ? "good" : "warning"}
              markerClassName={
                tool.successRate >= 98 ? "bg-emerald-500" : "bg-amber-500"
              }
            />
          </Link>
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
