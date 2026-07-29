"use client";

import { listAvailableWorkspaces } from "@/lib/dashboard";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const CREATE_WORKSPACE_PATH = "/workspaces/new";

/** 워크스페이스가 없는 사용자를 생성 화면으로 안내합니다. */
export default function WorkspaceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaces = useQuery({
    queryKey: ["workspaces", "available"],
    queryFn: listAvailableWorkspaces,
  });

  useEffect(() => {
    if (
      pathname !== CREATE_WORKSPACE_PATH &&
      workspaces.isSuccess &&
      workspaces.data.items.length === 0
    ) {
      router.replace(CREATE_WORKSPACE_PATH);
    }
  }, [pathname, router, workspaces.data, workspaces.isSuccess]);

  return <>{children}</>;
}
