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

const TOP_AGENT_LIMIT = 6;

export function TopAgents() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardUsageData(["dashboard.usage.top-agents"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={4} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.topAgents,
    TOP_AGENT_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.topAgents.length === 0}
      emptyText={t("noAgentUsageData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "에이전트",
          })}
        />
      }
    >
      {items.map((agent, index) => (
        <div key={agent.name}>
          <Link href={`/dashboard/agents/${encodeURIComponent(agent.name)}`}>
            <ListRow
              title={agent.name}
              description={t("recent24hRuns")}
              value={compactFormatter.format(agent.count)}
              markerClassName="bg-blue-500"
            />
          </Link>
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}
