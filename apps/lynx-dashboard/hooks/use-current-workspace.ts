"use client";

import { useQuery } from "@tanstack/react-query";
import { listAvailableWorkspaces } from "@/lib/dashboard";

/** 현재 UI가 사용하는 첫 번째 접근 가능 워크스페이스를 반환합니다. */
export function useCurrentWorkspace() {
  const result = useQuery({
    queryKey: ["workspaces", "available"],
    queryFn: listAvailableWorkspaces,
  });

  return {
    workspaceId: result.data?.items[0]?.id ?? "",
    hasWorkspace: (result.data?.items.length ?? 0) > 0,
    isPending: result.isPending,
    isError: result.isError,
    refetch: result.refetch,
  };
}
