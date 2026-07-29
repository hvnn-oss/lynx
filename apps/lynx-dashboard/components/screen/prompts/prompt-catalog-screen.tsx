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
import { ArrowRight, FilePlus2, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { formatDateTime } from "@/components/ui/operations/format";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import { getPromptOperationsSummary, listPrompts } from "@/lib/prompts";

const FIRST_PAGE_LIMIT = 25;
const ALL_ENVIRONMENTS = "__all__";

/** 프롬프트를 검색하고 생성 작업으로 진입하는 관리용 목록 화면입니다. */
export function PromptCatalogScreen() {
  const t = useTranslations("promptManagement");
  const workspace = useCurrentWorkspace();
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState(ALL_ENVIRONMENTS);
  const [deployment, setDeployment] = useState<
    "ALL" | "DEPLOYED" | "UNDEPLOYED" | "DRAFT_CHANGED"
  >("ALL");
  const deferredSearch = useDeferredValue(search.trim());
  const prompts = useInfiniteQuery({
    queryKey: [
      "prompts",
      workspace.workspaceId,
      deferredSearch,
      environment,
      deployment,
    ],
    queryFn: ({ pageParam }) =>
      listPrompts(workspace.workspaceId, {
        search: deferredSearch || undefined,
        environment:
          environment === ALL_ENVIRONMENTS
            ? undefined
            : (environment as "staging" | "production"),
        deployment,
        cursor: pageParam || undefined,
        limit: FIRST_PAGE_LIMIT,
      }),
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: workspace.hasWorkspace,
  });
  const summary = useQuery({
    queryKey: ["prompt-operations", workspace.workspaceId, "summary"],
    queryFn: () => getPromptOperationsSummary(workspace.workspaceId),
    enabled: workspace.hasWorkspace,
  });

  if (
    workspace.isPending ||
    (workspace.hasWorkspace && (prompts.isPending || summary.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || prompts.isError || summary.isError) {
    return (
      <ActualDataPageMessage
        pageTitle={t("catalog.title")}
        pageDescription={t("catalog.subtitle")}
        title={t("common.loadFailed")}
        description={t("common.retryDescription")}
        action={t("common.retry")}
        onRetry={() => {
          void workspace.refetch();
          void prompts.refetch();
          void summary.refetch();
        }}
      />
    );
  }

  const items = prompts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("catalog.title")}
        description={t("catalog.subtitle")}
        actions={
          <Button asChild>
            <Link href="/prompts/new">
              <FilePlus2 />
              {t("catalog.create")}
            </Link>
          </Button>
        }
      />

      <DashboardMetricGrid className="xl:grid-cols-3">
        <DashboardMetricCard
          label={t("catalog.metrics.total")}
          value={String(summary.data?.promptCount ?? 0)}
          description={t("catalog.metrics.totalHint")}
        />
        <DashboardMetricCard
          label={t("catalog.metrics.activeDeployments")}
          value={String(summary.data?.activeDeploymentCount ?? 0)}
          description={t("catalog.metrics.activeDeploymentsHint")}
        />
        <DashboardMetricCard
          label={t("catalog.metrics.activeExperiments")}
          value={String(summary.data?.activeExperimentCount ?? 0)}
          description={t("catalog.metrics.activeExperimentsHint")}
        />
      </DashboardMetricGrid>

      <section className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("catalog.searchPlaceholder")}
              aria-label={t("catalog.searchLabel")}
            />
          </div>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ENVIRONMENTS}>
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
            value={deployment}
            onValueChange={(value) =>
              setDeployment(
                value as "ALL" | "DEPLOYED" | "UNDEPLOYED" | "DRAFT_CHANGED",
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t("catalog.filters.allDeployments")}
              </SelectItem>
              <SelectItem value="DEPLOYED">
                {t("catalog.filters.deployed")}
              </SelectItem>
              <SelectItem value="UNDEPLOYED">
                {t("catalog.filters.undeployed")}
              </SelectItem>
              <SelectItem value="DRAFT_CHANGED">
                {t("catalog.filters.draftChanged")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DashboardPanel>
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-sm font-medium">
                {deferredSearch || deployment !== "ALL"
                  ? t("catalog.noSearchResults")
                  : t("catalog.empty")}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {deferredSearch || deployment !== "ALL"
                  ? t("catalog.noSearchResultsHint")
                  : t("catalog.emptyHint")}
              </p>
              {!deferredSearch && deployment === "ALL" ? (
                <Button asChild className="mt-4" variant="outline">
                  <Link href="/prompts/new">
                    <FilePlus2 />
                    {t("catalog.createFirst")}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map((prompt) => (
                <Link
                  className="group flex items-center justify-between gap-4 px-2 py-4 transition-colors hover:bg-muted/30"
                  href={`/prompts/${prompt.id}`}
                  key={prompt.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {prompt.name}
                      </p>
                      <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {t("catalog.draftRevision", {
                          revision: prompt.draftRevision,
                        })}
                      </span>
                      {prompt.latestVersion ? (
                        <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {prompt.latestVersion.version}
                        </span>
                      ) : null}
                      {prompt.activeDeployments.slice(0, 2).map((active) => (
                        <span
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700"
                          key={active.id}
                        >
                          {t(`deployment.environment.${active.environment}`)}
                          {active.agentName ? ` · ${active.agentName}` : ""}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {prompt.description.trim() || t("catalog.noDescription")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="hidden text-xs text-muted-foreground sm:block">
                      {t("catalog.updatedAt", {
                        date: formatDateTime(prompt.updatedAt),
                      })}
                    </p>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
              {prompts.hasNextPage ? (
                <div className="flex justify-center py-3">
                  <Button
                    variant="ghost"
                    disabled={prompts.isFetchingNextPage}
                    onClick={() => void prompts.fetchNextPage()}
                  >
                    {prompts.isFetchingNextPage
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
