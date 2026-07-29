"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview, listAvailableWorkspaces } from "@/lib/dashboard";
import { listWorkspaceRuns } from "@/lib/runs";

export function useDashboardOverview() {
  const workspaces = useQuery({
    queryKey: ["workspaces", "available"],
    queryFn: listAvailableWorkspaces,
  });
  const workspaceId = workspaces.data?.items[0]?.id ?? "";
  const hasWorkspace = workspaceId.length > 0;
  const overview = useQuery({
    queryKey: ["dashboard", "overview", workspaceId],
    queryFn: () => getDashboardOverview(workspaceId),
    enabled: hasWorkspace,
  });
  const runs = useQuery({
    queryKey: ["dashboard", "overview", "runs", workspaceId],
    queryFn: () => listWorkspaceRuns(workspaceId, { limit: 100 }),
    enabled: hasWorkspace,
  });

  return {
    data:
      overview.data && runs.data
        ? { overview: overview.data, runs: runs.data }
        : undefined,
    workspaceId,
    isPending:
      workspaces.isPending ||
      (hasWorkspace && (overview.isPending || runs.isPending)),
    isError: workspaces.isError || overview.isError || runs.isError,
    refetch: async () => {
      await Promise.all([
        workspaces.refetch(),
        overview.refetch(),
        runs.refetch(),
      ]);
    },
  };
}
