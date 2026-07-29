"use client";

import { getDashboardBootstrap } from "@/lib/bootstrap";
import { useUserStore } from "@/stores/userStore";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { AccessPending } from "@/components/screen/access/access-pending";

/**
 * Loads identity and tenant context once before dashboard screens are mounted.
 */
export default function DashboardBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("bootstrap");
  const queryClient = useQueryClient();
  const setContext = useUserStore((state) => state.setContext);
  const storedUser = useUserStore((state) => state.user);
  const context = useQuery({
    queryKey: ["dashboard", "bootstrap"],
    queryFn: getDashboardBootstrap,
  });

  useEffect(() => {
    if (!context.data) return;

    setContext(context.data);
    // Existing workspace hooks reuse the bootstrap result without another call.
    queryClient.setQueryData(["workspaces", "available"], {
      items: context.data.workspaces,
    });
    queryClient.setQueryData(["organizations", "available"], {
      items: context.data.organizations,
    });
  }, [context.data, queryClient, setContext]);

  if (context.isPending || (context.data && !storedUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (context.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t("error")}</p>
          <Button variant="outline" onClick={() => void context.refetch()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (context.data && !context.data.access.canUseProduct) {
    return (
      <AccessPending
        user={context.data.user}
        access={context.data.access}
        isRefreshing={context.isFetching}
        onRefresh={() => void context.refetch()}
      />
    );
  }

  return <>{children}</>;
}
