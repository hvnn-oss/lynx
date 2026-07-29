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
  listPromptExperimentOperations,
} from "@/lib/prompts";

const ALL = "__all__";

/** 전역 A/B 실험과 변형별 트래픽·성과를 일괄 조회합니다. */
export function PromptExperimentsScreen() {
  const t = useTranslations("promptManagement");
  const workspace = useCurrentWorkspace();
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const deferredSearch = useDeferredValue(search.trim());
  const experiments = useInfiniteQuery({
    queryKey: [
      "prompt-experiment-operations",
      workspace.workspaceId,
      deferredSearch,
      environment,
      status,
    ],
    queryFn: ({ pageParam }) =>
      listPromptExperimentOperations(workspace.workspaceId, {
        search: deferredSearch || undefined,
        environment:
          environment === ALL
            ? undefined
            : (environment as "staging" | "production"),
        status:
          status === ALL
            ? undefined
            : (status as "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"),
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
    (workspace.hasWorkspace && (experiments.isPending || summary.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || experiments.isError || summary.isError) {
    return (
      <ActualDataPageMessage
        pageTitle={t("experiments.title")}
        pageDescription={t("experiments.subtitle")}
        title={t("common.loadFailed")}
        description={t("common.retryDescription")}
        action={t("common.retry")}
        onRetry={() => {
          void workspace.refetch();
          void experiments.refetch();
          void summary.refetch();
        }}
      />
    );
  }

  const items = experiments.data?.pages.flatMap((page) => page.items) ?? [];
  const totalRuns = items.reduce(
    (sum, experiment) =>
      sum +
      experiment.variants.reduce(
        (variantSum, variant) => variantSum + variant.metrics.runCount,
        0,
      ),
    0,
  );
  const issueCount = items.reduce(
    (sum, experiment) =>
      sum +
      experiment.variants.reduce(
        (variantSum, variant) => variantSum + variant.changeImpactIssueCount,
        0,
      ),
    0,
  );

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("experiments.title")}
        description={t("experiments.subtitle")}
      />
      <DashboardMetricGrid className="xl:grid-cols-3">
        <DashboardMetricCard
          label={t("experiments.metrics.active")}
          value={String(summary.data?.activeExperimentCount ?? 0)}
          description={t("experiments.metrics.activeHint")}
          tone="good"
        />
        <DashboardMetricCard
          label={t("experiments.metrics.runs")}
          value={totalRuns.toLocaleString()}
          description={t("experiments.metrics.runsHint")}
        />
        <DashboardMetricCard
          label={t("experiments.metrics.issues")}
          value={String(issueCount)}
          description={t("experiments.metrics.issuesHint")}
          tone={issueCount > 0 ? "warning" : "neutral"}
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
              placeholder={t("experiments.search")}
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
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t("experiments.filters.all")}
              </SelectItem>
              {(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const).map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {t(`experiments.status.${value}`)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <DashboardPanel>
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("experiments.empty")}
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map((experiment) => (
                <Link
                  className="block space-y-3 py-4"
                  href={`/prompts/${experiment.promptId}`}
                  key={experiment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{experiment.name}</p>
                        <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {t(`experiments.status.${experiment.status}`)}
                        </span>
                        <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {t(
                            `deployment.environment.${experiment.environment}`,
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {experiment.promptName} ·{" "}
                        {experiment.agentName ?? t("deployment.allAgents")} ·{" "}
                        {formatDateTime(experiment.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {experiment.variants.map((variant) => (
                      <div
                        className="rounded-lg border bg-muted/20 px-3 py-2"
                        key={variant.versionId}
                      >
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium">{variant.version}</span>
                          <span>{variant.weight}%</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("experiments.variantResult", {
                            runs: variant.metrics.runCount,
                            success: formatRate(variant.metrics.successRate),
                            errors: formatRate(variant.metrics.errorRate),
                            cost: formatCost(variant.metrics.averageCost),
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </Link>
              ))}
              {experiments.hasNextPage ? (
                <div className="flex justify-center py-3">
                  <Button
                    variant="ghost"
                    disabled={experiments.isFetchingNextPage}
                    onClick={() => void experiments.fetchNextPage()}
                  >
                    {experiments.isFetchingNextPage
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

function formatRate(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCost(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}
