"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";

const workspaceRedirectPath = "/workspaces/select";

export default function WorkspaceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const selectedWorkspaceId = useDashboardUiStore(
    (state) => state.selectedWorkspaceId,
  );
  const [hasHydrated, setHasHydrated] = useState(
    useDashboardUiStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribe = useDashboardUiStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    setHasHydrated(useDashboardUiStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (runtimeConfig.demoMode || !hasHydrated || selectedWorkspaceId) return;
    if (pathname?.startsWith("/workspaces")) return;

    router.replace(workspaceRedirectPath);
  }, [hasHydrated, pathname, router, selectedWorkspaceId]);

  if (!runtimeConfig.demoMode && !hasHydrated) {
    return null;
  }

  if (!runtimeConfig.demoMode && !selectedWorkspaceId) {
    return null;
  }

  return <>{children}</>;
}
