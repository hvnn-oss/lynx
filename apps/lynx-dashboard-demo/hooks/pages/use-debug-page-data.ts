"use client";

import { useMemo } from "react";
import {
  useDebugSessionEventsQuery,
  useDebugSessionsQuery,
  useDebugTimelineQuery,
} from "@/hooks/queries/debug";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { useDebugUiStore } from "@/stores/debug-ui-store";

export function useDebugPageData() {
  const workspaceId = useDashboardUiStore((state) => state.selectedWorkspaceId);
  const selectedSessionId = useDebugUiStore((state) => state.selectedSessionId);
  const filters = useDebugUiStore((state) => state.filters);

  const sessionQuery = useMemo(
    () => ({
      workspaceId,
      from: filters.from,
      to: filters.to,
      severity: filters.severity,
      limit: 50,
    }),
    [filters.from, filters.severity, filters.to, workspaceId],
  );
  const timelineQuery = useMemo(
    () => ({
      workspaceId,
      includePayload: filters.includePayload,
    }),
    [filters.includePayload, workspaceId],
  );
  const eventQuery = useMemo(
    () => ({
      workspaceId,
      from: filters.from,
      to: filters.to,
      severity: filters.severity,
      errorsOnly: filters.errorsOnly,
      limit: 100,
    }),
    [
      filters.errorsOnly,
      filters.from,
      filters.severity,
      filters.to,
      workspaceId,
    ],
  );

  const sessions = useDebugSessionsQuery(sessionQuery);
  const timeline = useDebugTimelineQuery(selectedSessionId, timelineQuery);
  const events = useDebugSessionEventsQuery(selectedSessionId, eventQuery);

  return {
    workspaceId,
    selectedSessionId,
    sessions,
    timeline,
    events,
  };
}
