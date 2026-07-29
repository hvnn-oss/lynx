"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getDashboardIngestionStatus,
  listAvailableWorkspaces,
} from "@/lib/dashboard";

export function useDashboardIngestionStatus() {
  const workspaces = useQuery({
    queryKey: ["workspaces", "available"],
    queryFn: listAvailableWorkspaces,
  });
  const workspaceId = workspaces.data?.items[0]?.id ?? "";
  const hasWorkspace = workspaceId.length > 0;
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
      workspaces.isPending || (hasWorkspace && ingestionStatus.isPending),
    isError: workspaces.isError || ingestionStatus.isError,
    refetch: async () => {
      await Promise.all([workspaces.refetch(), ingestionStatus.refetch()]);
    },
  };
}
