"use client";

import { useEffect } from "react";
import {
  useDashboardCostQuery,
  useDashboardInsightsQuery,
  useDashboardMetricsQuery,
  useDashboardStatusQuery,
  useDashboardUsageQuery,
} from "@/hooks/queries/dashboard";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";

export function useDashboardMetricsData(panelIds: string[] = []) {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const markPanelDataReady = useDashboardUiStore(
    (state) => state.markPanelDataReady,
  );
  const query = useDashboardMetricsQuery(workspaceId);
  const panelKey = panelIds.join("|");

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    for (const panelId of panelKey.split("|").filter(Boolean)) {
      markPanelDataReady(panelId, query.dataUpdatedAt);
    }
  }, [markPanelDataReady, panelKey, query.dataUpdatedAt]);

  return query;
}

export function useDashboardUsageData(panelIds: string[] = []) {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const markPanelDataReady = useDashboardUiStore(
    (state) => state.markPanelDataReady,
  );
  const query = useDashboardUsageQuery(workspaceId);
  const panelKey = panelIds.join("|");

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    for (const panelId of panelKey.split("|").filter(Boolean)) {
      markPanelDataReady(panelId, query.dataUpdatedAt);
    }
  }, [markPanelDataReady, panelKey, query.dataUpdatedAt]);

  return query;
}

export function useDashboardStatusData(panelIds: string[] = []) {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const markPanelDataReady = useDashboardUiStore(
    (state) => state.markPanelDataReady,
  );
  const query = useDashboardStatusQuery(workspaceId);
  const panelKey = panelIds.join("|");

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    for (const panelId of panelKey.split("|").filter(Boolean)) {
      markPanelDataReady(panelId, query.dataUpdatedAt);
    }
  }, [markPanelDataReady, panelKey, query.dataUpdatedAt]);

  return query;
}

export function useDashboardCostData(panelIds: string[] = []) {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const markPanelDataReady = useDashboardUiStore(
    (state) => state.markPanelDataReady,
  );
  const query = useDashboardCostQuery(workspaceId);
  const panelKey = panelIds.join("|");

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    for (const panelId of panelKey.split("|").filter(Boolean)) {
      markPanelDataReady(panelId, query.dataUpdatedAt);
    }
  }, [markPanelDataReady, panelKey, query.dataUpdatedAt]);

  return query;
}

export function useDashboardInsightsData(panelIds: string[] = []) {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const markPanelDataReady = useDashboardUiStore(
    (state) => state.markPanelDataReady,
  );
  const query = useDashboardInsightsQuery(workspaceId);
  const panelKey = panelIds.join("|");

  useEffect(() => {
    if (!query.dataUpdatedAt) return;
    for (const panelId of panelKey.split("|").filter(Boolean)) {
      markPanelDataReady(panelId, query.dataUpdatedAt);
    }
  }, [markPanelDataReady, panelKey, query.dataUpdatedAt]);

  return query;
}
