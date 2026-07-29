"use client";

import {
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { formatDateTime } from "@/components/ui/operations/format";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import {
  getPromptOperationsSummary,
  listPromptDeploymentOperations,
} from "@/lib/prompts";

const ALL = "__all__";

/** 전역 배포 이력을 한 번의 커서 API로 조회하고 운영 상태를 표시합니다. */
export function PromptDeploymentsScreen() {
  const t = useTranslations("promptManagement");
  const workspace = useCurrentWorkspace();
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState(ALL);
  const [state, setState] = useState<"ALL" | "ACTIVE" | "HISTORY">("ACTIVE");
  const deferredSearch = useDeferredValue(search.trim());
  const deployments = useInfiniteQuery({
    queryKey: [
      "prompt-deployment-operations",
      workspace.workspaceId,
      deferredSearch,
      environment,
      state,
    ],
    queryFn: ({ pageParam }) =>
      listPromptDeploymentOperations(workspace.workspaceId, {
        search: deferredSearch || undefined,
        environment:
          environment === ALL
            ? undefined
            : (environment as "staging" | "production"),
        active: state === "ALL" ? undefined : state === "ACTIVE",
        cursor: pageParam || undefined,
        limit: 25,
      }),
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: workspace.hasWorkspace,
  });
  const summary = useQuery({
    queryKey: ["prompt-operations", workspace.workspaceId, "summary"],
    queryFn: () => getPromptOperationsSummary(workspace.workspaceId),
    enabled: workspace.hasWorkspace,
  });

  if (
    workspace.isPending ||
    (workspace.hasWorkspace && (deployments.isPending || summary.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || deployments.isError || summary.isError) {
    return (
      <ActualDataPageMessage
        pageTitle={t("deploymentsPage.title")}
        pageDescription={t("deploymentsPage.subtitle")}
        title={t("common.loadFailed")}
        description={t("common.retryDescription")}
        action={t("common.retry")}
        onRetry={() => {
          void workspace.refetch();
          void deployments.refetch();
          void summary.refetch();
        }}
      />
    );
  }

  const items = deployments.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("deploymentsPage.title")}
        description={t("deploymentsPage.subtitle")}
      />
      <DashboardMetricGrid className="xl:grid-cols-3">
        <DashboardMetricCard
          label={t("deploymentsPage.metrics.active")}
          value={String(summary.data?.activeDeploymentCount ?? 0)}
          description={t("deploymentsPage.metrics.activeHint")}
          tone="good"
        />
        <DashboardMetricCard
          label={t("deploymentsPage.metrics.lastChanged")}
          value={
            summary.data?.lastConfigurationChangedAt
              ? formatDateTime(summary.data.lastConfigurationChangedAt)
              : "-"
          }
          description={t("deploymentsPage.metrics.lastChangedHint")}
        />
        <DashboardMetricCard
          label={t("deploymentsPage.metrics.sdkRefresh")}
          value={t("sdkRefresh.seconds", {
            count:
              (summary.data?.sdkConfig.defaultRefreshIntervalMs ?? 60_000) /
              1_000,
          })}
          description={t("deploymentsPage.metrics.sdkRefreshHint")}
        />
      </DashboardMetricGrid>

      <section className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("deploymentsPage.search")}
            />
          </div>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t("catalog.filters.allEnvironments")}
              </SelectItem>
              <SelectItem value="staging">
                {t("deployment.environment.staging")}
              </SelectItem>
              <SelectItem value="production">
                {t("deployment.environment.production")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={state}
            onValueChange={(value) =>
              setState(value as "ALL" | "ACTIVE" | "HISTORY")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">
                {t("deploymentsPage.filters.active")}
              </SelectItem>
              <SelectItem value="HISTORY">
                {t("deploymentsPage.filters.history")}
              </SelectItem>
              <SelectItem value="ALL">
                {t("deploymentsPage.filters.all")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DashboardPanel>
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("deploymentsPage.empty")}
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map((deployment) => (
                <Link
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                  href={`/prompts/${deployment.promptId}`}
                  key={deployment.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {deployment.promptName} · {deployment.version}
                      </p>
                      <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {t(`deployment.environment.${deployment.environment}`)}
                      </span>
                      {deployment.active ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
                          {t("deployment.active")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {deployment.agentName ?? t("deployment.allAgents")} ·{" "}
                      {formatDateTime(deployment.deployedAt)}
                    </p>
                  </div>
                  <p className="max-w-sm truncate text-xs text-muted-foreground">
                    {deployment.reason ?? t("deployment.noReason")}
                  </p>
                </Link>
              ))}
              {deployments.hasNextPage ? (
                <div className="flex justify-center py-3">
                  <Button
                    variant="ghost"
                    disabled={deployments.isFetchingNextPage}
                    onClick={() => void deployments.fetchNextPage()}
                  >
                    {deployments.isFetchingNextPage
                      ? t("catalog.loadingMore")
                      : t("catalog.loadMore")}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </DashboardPanel>
      </section>
    </div>
  );
}
