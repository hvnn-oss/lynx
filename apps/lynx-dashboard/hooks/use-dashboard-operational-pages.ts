"use client";

import type {
  DashboardAgentScope,
  DashboardSessionScope,
} from "@repo/dto";
import { useQuery } from "@tanstack/react-query";
import {
  getDashboardAgentsActive,
  getDashboardAgentsInactive,
  getDashboardAgentsOverview,
  getDashboardAgentDetail,
  getDashboardCost,
  getDashboardSessionsCompleted,
  getDashboardSessionsFailed,
  getDashboardSessionsOverview,
  getDashboardSessionDetail,
  listAvailableWorkspaces,
} from "@/lib/dashboard";

const SESSION_QUERY = {
  ALL: getDashboardSessionsOverview,
  COMPLETED: getDashboardSessionsCompleted,
  FAILED: getDashboardSessionsFailed,
} satisfies Record<DashboardSessionScope, (workspaceId: string) => Promise<unknown>>;

const AGENT_QUERY = {
  ALL: getDashboardAgentsOverview,
  ACTIVE: getDashboardAgentsActive,
  INACTIVE: getDashboardAgentsInactive,
} satisfies Record<DashboardAgentScope, (workspaceId: string) => Promise<unknown>>;

export function useDashboardSessions(scope: DashboardSessionScope) {
  return useWorkspaceDashboardQuery(
    ["dashboard", "sessions", scope],
    SESSION_QUERY[scope],
  );
}

export function useDashboardAgents(scope: DashboardAgentScope) {
  return useWorkspaceDashboardQuery(
    ["dashboard", "agents", scope],
    AGENT_QUERY[scope],
  );
}

export function useDashboardCost() {
  return useWorkspaceDashboardQuery(
    ["dashboard", "cost"],
    getDashboardCost,
  );
}

export function useDashboardSessionDetail(id: string) {
  return useWorkspaceDashboardQuery(
    ["dashboard", "sessions", "detail", id],
    (workspaceId) => getDashboardSessionDetail(workspaceId, id),
  );
}

export function useDashboardAgentDetail(id: string) {
  return useWorkspaceDashboardQuery(
    ["dashboard", "agents", "detail", id],
    (workspaceId) => getDashboardAgentDetail(workspaceId, id),
  );
}

function useWorkspaceDashboardQuery<T>(
  queryKey: string[],
  query: (workspaceId: string) => Promise<T>,
) {
  const workspaces = useQuery({
    queryKey: ["workspaces", "available"],
    queryFn: listAvailableWorkspaces,
  });
  const workspaceId = workspaces.data?.items[0]?.id ?? "";
  const hasWorkspace = workspaceId.length > 0;
  const page = useQuery({
    queryKey: [...queryKey, workspaceId],
    queryFn: () => query(workspaceId),
    enabled: hasWorkspace,
  });

  return {
    data: page.data,
    hasWorkspace,
    isPending: workspaces.isPending || (hasWorkspace && page.isPending),
    isError: workspaces.isError || page.isError,
    refetch: async () => {
      await Promise.all([workspaces.refetch(), page.refetch()]);
    },
  };
}
