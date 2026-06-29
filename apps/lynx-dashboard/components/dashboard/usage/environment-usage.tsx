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

const ENVIRONMENT_LIMIT = 5;

export function EnvironmentUsage() {
  const t = useTranslations("dashboard.shared");
  const query = useDashboardUsageData(["dashboard.usage.environments"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="h-full" rows={4} />;
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.environmentUsage,
    ENVIRONMENT_LIMIT,
  );

  return (
    <ListPanel
      empty={query.data.environmentUsage.length === 0}
      emptyText={t("noEnvironmentUsageData")}
      footer={
        <DashboardMoreRow
          hiddenCount={hiddenCount}
          label={t("remainingItems", {
            count: hiddenCount,
            itemName: "환경",
          })}
        />
      }
    >
      {items.map((environment, index) => (
        <div key={environment.environment}>
          <Link
            href={`/dashboard/environments/${encodeURIComponent(environment.environment)}`}
          >
            <ListRow
              title={formatEnvironmentName(environment.environment, t)}
              description={t("runEnvironment")}
              value={compactFormatter.format(environment.runs)}
              markerClassName={getEnvironmentMarker(environment.environment)}
            />
          </Link>
          {index < items.length - 1 ? <RowSeparator /> : null}
        </div>
      ))}
    </ListPanel>
  );
}

function formatEnvironmentName(
  environment: string,
  t: ReturnType<typeof useTranslations<"dashboard.shared">>,
) {
  if (environment === "unknown") return t("unknownEnvironment");
  return environment;
}

function getEnvironmentMarker(environment: string) {
  if (environment === "production") return "bg-rose-500";
  if (environment === "staging") return "bg-amber-500";
  if (environment === "preview") return "bg-blue-500";
  return "bg-teal-500";
}
