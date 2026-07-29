"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "@/lib/dashboard";
import { listWorkspaceRuns } from "@/lib/runs";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";

export function useDashboardOverview() {
  const workspace = useCurrentWorkspace();
  const workspaceId = workspace.workspaceId;
  const hasWorkspace = workspace.hasWorkspace;
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
      workspace.isPending ||
      (hasWorkspace && (overview.isPending || runs.isPending)),
    isError: workspace.isError || overview.isError || runs.isError,
    refetch: async () => {
      await Promise.all([
        workspace.refetch(),
        overview.refetch(),
        runs.refetch(),
      ]);
    },
  };
}
