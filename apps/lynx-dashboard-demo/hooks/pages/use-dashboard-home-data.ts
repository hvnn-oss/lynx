"use client";

import { useEffect } from "react";
import { useDashboardHomeQuery } from "@/hooks/queries/dashboard";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";

export function useDashboardHomeData() {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const markPanelDataReady = useDashboardUiStore(
    (state) => state.markPanelDataReady,
  );
  const query = useDashboardHomeQuery(workspaceId);

  useEffect(() => {
    if (!query.dataUpdatedAt) return;

    markPanelDataReady("dashboard.home", query.dataUpdatedAt);
    markPanelDataReady("dashboard.kpis", query.dataUpdatedAt);
    markPanelDataReady("dashboard.health", query.dataUpdatedAt);
    markPanelDataReady("dashboard.run-volume", query.dataUpdatedAt);
    markPanelDataReady("dashboard.failure-trend", query.dataUpdatedAt);
    markPanelDataReady("dashboard.recent-issues", query.dataUpdatedAt);
  }, [markPanelDataReady, query.dataUpdatedAt]);

  return {
    workspaceId,
    query,
    data: query.data,
  };
}
