"use client";

import { useQuery } from "@tanstack/react-query";
import { listAvailableWorkspaces } from "@/lib/dashboard";
import { useUserStore } from "@/stores/userStore";

/** 현재 선택된 조직의 활성 워크스페이스를 반환합니다. */
export function useCurrentWorkspace() {
  const activeWorkspaceId = useUserStore((state) => state.activeWorkspaceId);
  const result = useQuery({
    queryKey: ["workspaces", "available"],
    queryFn: listAvailableWorkspaces,
  });
  const workspaceId =
    result.data?.items.find((workspace) => workspace.id === activeWorkspaceId)
      ?.id ??
    result.data?.items[0]?.id ??
    "";

  return {
    workspaceId,
    hasWorkspace: workspaceId.length > 0,
    isPending: result.isPending,
    isError: result.isError,
    refetch: result.refetch,
  };
}
