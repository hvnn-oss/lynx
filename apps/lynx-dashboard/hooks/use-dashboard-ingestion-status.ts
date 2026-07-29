"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardIngestionStatus } from "@/lib/dashboard";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";

export function useDashboardIngestionStatus() {
  const workspace = useCurrentWorkspace();
  const workspaceId = workspace.workspaceId;
  const hasWorkspace = workspace.hasWorkspace;
  const ingestionStatus = useQuery({
    queryKey: ["dashboard", "ingestion-status", workspaceId],
    queryFn: () => getDashboardIngestionStatus(workspaceId),
    enabled: hasWorkspace,
    refetchInterval: 60_000,
  });

  return {
    data: ingestionStatus.data,
    hasWorkspace,
    isPending:
      workspace.isPending || (hasWorkspace && ingestionStatus.isPending),
    isError: workspace.isError || ingestionStatus.isError,
    refetch: async () => {
      await Promise.all([workspace.refetch(), ingestionStatus.refetch()]);
    },
  };
}
