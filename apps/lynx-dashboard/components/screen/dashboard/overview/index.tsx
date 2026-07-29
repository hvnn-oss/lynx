"use client";

import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import { useMemo } from "react";
import { AgentHealthList } from "./agent-health-list";
import { IncidentInsight } from "./incident-insight";
import {
  buildAgentHealth,
  buildOverviewSummary,
  buildRunTrend,
} from "./overview-model";
import { OverviewError } from "./overview-error";
import { OverviewLoading } from "./overview-loading";
import { OverviewMetrics } from "./overview-metrics";
import { OverviewTrends } from "./overview-trends";
import { RecentIssues } from "./recent-issues";
import { NoDataScreen } from "../../no-data";

export function DashboardOverviewScreen() {
  const { data, isPending, isError, refetch } = useDashboardOverview();
  const summary = useMemo(
    () => (data ? buildOverviewSummary(data.overview, data.runs) : undefined),
    [data],
  );
  const trend = useMemo(
    () => (data ? buildRunTrend(data.runs.items) : []),
    [data],
  );
  const agents = useMemo(
    () => (data ? buildAgentHealth(data.runs.items) : []),
    [data],
  );

  if (isPending) return <OverviewLoading />;
  if (isError) return <OverviewError onRetry={() => void refetch()} />;
  if (!data || (!data.overview.hasData && data.runs.items.length === 0))
    return <NoDataScreen />;

  return (
    <div className="space-y-8">
      {summary ? <OverviewMetrics summary={summary} /> : null}
      <IncidentInsight issues={data.overview.importantIssues} />
      <OverviewTrends trend={trend} />
      <div className="grid gap-8 xl:grid-cols-2">
        <AgentHealthList agents={agents} />
        <RecentIssues issues={data.overview.importantIssues} />
      </div>
    </div>
  );
}
