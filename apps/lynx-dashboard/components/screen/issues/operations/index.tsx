"use client";

import type { IssueStatus } from "@repo/constants";
import type {
  GetIssueActivitiesResponseDto,
  GetIssueAssigneesResponseDto,
  GetIssueRecordsResponseDto,
  GetIssuesQueryInput,
  GetIssuesResponseDto,
  GetIssuesSummaryResponseDto,
} from "@repo/dto";
import {
  DashboardChartPanel,
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
  DashboardSectionHeader,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import type { ChartConfig } from "@repo/ui/components/ui/chart";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, Pencil, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { DashboardAreaChart } from "@/components/ui/dashboard/area-chart";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import {
  useIssueDetailPageData,
  useIssuesPageData,
} from "@/hooks/use-issue-page-data";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import {
  createWorkspaceIssueComment,
  deleteWorkspaceIssueComment,
  getWorkspaceIssuesSummary,
  listWorkspaceIssueRecords,
  listWorkspaceIssues,
  updateWorkspaceIssueAssignees,
  updateWorkspaceIssueComment,
  updateWorkspaceIssueStatus,
  type IssueRecordsQuery,
} from "@/lib/issues";

type IssueItem = GetIssuesResponseDto["items"][number];
type IssueRecordItem = GetIssueRecordsResponseDto["items"][number];
type IssueActivityItem = GetIssueActivitiesResponseDto["items"][number];
type MentionUser = GetIssueAssigneesResponseDto["availableUsers"][number];

const ISSUE_LIST_PAGE_SIZE = 25;
const ISSUE_RECORD_PAGE_SIZE = 25;
const ISSUE_DETAIL_PAGE_SIZE = 8;

/** 열린 이슈와 최근 발생 흐름을 한 화면에서 요약합니다. */
export function IssuesOverviewScreen() {
  const t = useTranslations("issues");
  const format = useFormatter();
  const workspace = useCurrentWorkspace();
  const result = useIssuesPageData({
    workspaceId: workspace.workspaceId,
    issuesQuery: { limit: 100 },
    enabled: workspace.hasWorkspace,
  });

  if (workspace.isPending || result.isPending) return <ActualDataPageLoading />;
  if (workspace.isError || result.isError || !result.data) {
    return (
      <IssuePageMessage
        pageKey="overview"
        onRetry={() => void result.refetch()}
      />
    );
  }

  const openItems = result.data.issues.items
    .filter(
      (issue) => issue.status === "OPEN" || issue.status === "INVESTIGATING",
    )
    .sort(compareIssuePriority);
  const buckets = buildIssueTrend(result.data.issues.items);
  const affectedEnvironments = new Set(
    openItems.map((issue) => issue.environment),
  ).size;
  const affectedScopes = buildAffectedScopes(openItems, t("list.unknownAgent"));
  const issueTrendConfig = {
    count: {
      label: t("overview.trendSeries"),
      color: "var(--destructive)",
    },
  } satisfies ChartConfig;
  const hasTrendData = buckets.some((bucket) => bucket.count > 0);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("overview.title")}
        description={t("overview.subtitle")}
      />
      <IssueSummaryMetrics
        summary={result.data.summary}
        affectedEnvironments={affectedEnvironments}
      />
      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardChartPanel empty={!hasTrendData} emptyText={t("empty")}>
          <div>
            <h2 className="text-sm font-semibold">
              {t("overview.trendTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("overview.trendDescription")}
            </p>
            <DashboardAreaChart
              categoryKey="date"
              chartConfig={issueTrendConfig}
              chartData={buckets}
              className="mt-5 h-64"
              curveType="monotone"
              gradient
              showLegend={false}
              tickFormatter={(value) =>
                format.dateTime(new Date(`${value}T00:00:00Z`), {
                  month: "numeric",
                  day: "numeric",
                })
              }
            />
          </div>
        </DashboardChartPanel>
        <DashboardListPanel
          empty={affectedScopes.length === 0}
          emptyText={t("overview.affectedEmpty")}
        >
          <h2 className="px-2 pb-2 text-sm font-semibold">
            {t("overview.affectedTitle")}
          </h2>
          {affectedScopes.slice(0, 8).map((scope) => (
            <DashboardListRow
              key={scope.key}
              title={scope.agent}
              description={t("overview.affectedDescription", {
                environments: scope.environments.join(", "),
                issues: scope.issueCount,
              })}
              value={t("overview.affectedOccurrences", {
                count: scope.occurrenceCount,
              })}
              tone={scope.criticalCount > 0 ? "bad" : "neutral"}
            />
          ))}
        </DashboardListPanel>
      </section>
      <IssueRows
        title={t("overview.priorityTitle")}
        emptyText={t("overview.priorityEmpty")}
        items={openItems.slice(0, 5)}
      />
    </div>
  );
}

/** 새로 접수된 OPEN 이슈만 검토 대기열로 표시합니다. */
export function IssuesReviewScreen() {
  return (
    <WorkflowIssueListScreen
      pageKey="review"
      query={{ status: "OPEN", limit: 100 }}
    />
  );
}

/** 운영자가 원인을 확인 중인 이슈만 표시합니다. */
export function IssuesInvestigatingScreen() {
  return (
    <WorkflowIssueListScreen
      pageKey="investigating"
      query={{ status: "INVESTIGATING", limit: 100 }}
    />
  );
}

/** SDK가 보낸 Recovery record와 현재 처리 상태를 표시합니다. */
export function IssueRecoveryScreen() {
  const t = useTranslations("issues");
  const workspace = useCurrentWorkspace();
  const records = useInfiniteIssueRecordList(
    workspace.workspaceId,
    { recordKind: "RECOVERY", limit: ISSUE_RECORD_PAGE_SIZE },
    workspace.hasWorkspace,
  );
  const recordItems = records.data?.pages.flatMap((page) => page.items) ?? [];
  const summary = records.data?.pages[0]?.summary;

  if (workspace.isPending || (workspace.hasWorkspace && records.isPending)) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || records.isError || !summary) {
    return (
      <IssuePageMessage
        pageKey="recovery"
        onRetry={() => void records.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("recovery.title")}
        description={t("recovery.subtitle")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("recovery.pending")}
          value={String(summary.recoveryPending)}
          description={t("recovery.pendingHint")}
          tone={summary.recoveryPending > 0 ? "warning" : "neutral"}
        />
        <DashboardMetricCard
          label={t("intake.deferred")}
          value={String(summary.deferred)}
          description={t("intake.deferredHint")}
        />
        <DashboardMetricCard
          label={t("intake.delayed")}
          value={String(summary.delayed)}
          description={t("intake.delayedHint")}
          tone={summary.delayed > 0 ? "bad" : "neutral"}
        />
      </DashboardMetricGrid>
      <IssueRecordRows items={recordItems} emptyText={t("recovery.empty")} />
      <LoadMoreButton
        hasNextPage={records.hasNextPage}
        isFetchingNextPage={records.isFetchingNextPage}
        onLoadMore={() => void records.fetchNextPage()}
      />
      {summary.recoveryPending > 0 ? (
        <DashboardPanel>
          <p className="text-sm font-semibold">{t("recovery.noticeTitle")}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("recovery.noticeDescription")}
          </p>
        </DashboardPanel>
      ) : null}
    </div>
  );
}

/** Stable fingerprint가 같은 이슈를 반복 원인 후보로 묶습니다. */
export function IssuePatternsScreen() {
  const t = useTranslations("issues");
  const format = useFormatter();
  const workspace = useCurrentWorkspace();
  const result = useInfiniteIssueList(
    workspace.workspaceId,
    { limit: ISSUE_LIST_PAGE_SIZE },
    workspace.hasWorkspace,
  );

  if (workspace.isPending || result.isPending) return <ActualDataPageLoading />;
  if (workspace.isError || result.isError || !result.data) {
    return (
      <IssuePageMessage
        pageKey="patterns"
        onRetry={() => void result.refetch()}
      />
    );
  }

  const groups = buildFingerprintGroups(
    result.data.pages.flatMap((page) => page.items),
  );
  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("patterns.title")}
        description={t("patterns.subtitle")}
      />
      <DashboardListPanel
        empty={groups.length === 0}
        emptyText={t("patterns.empty")}
      >
        {groups.map((group) => (
          <Link
            href={`/issues/${group.representativeIssueId}`}
            key={group.fingerprint}
          >
            <DashboardListRow
              title={group.title}
              description={t("patterns.rowDescription", {
                variants: group.issueCount,
                agents: group.agents.size,
                lastSeen: format.dateTime(new Date(group.lastSeenAt), {
                  dateStyle: "short",
                  timeStyle: "short",
                }),
              })}
              value={t("patterns.occurrenceCount", {
                count: group.occurrenceCount,
              })}
              tone={group.issueCount > 1 ? "warning" : "neutral"}
            />
          </Link>
        ))}
      </DashboardListPanel>
      <LoadMoreButton
        hasNextPage={result.hasNextPage}
        isFetchingNextPage={result.isFetchingNextPage}
        onLoadMore={() => void result.fetchNextPage()}
      />
      <DashboardPanel>
        <p className="text-sm font-semibold">
          {t("patterns.fingerprintTitle")}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("patterns.fingerprintDescription")}
        </p>
      </DashboardPanel>
    </div>
  );
}

/** 변경 이후 악화가 감지된 실제 PROMPT_REGRESSION 이슈를 표시합니다. */
export function IssueChangeImpactScreen() {
  return (
    <WorkflowIssueListScreen
      pageKey="changeImpact"
      query={{ category: "PROMPT_REGRESSION", limit: 100 }}
    />
  );
}

/** 해결 또는 무시로 종료된 이슈를 한 기록 화면에 모읍니다. */
export function IssueHistoryScreen() {
  const t = useTranslations("issues");
  const workspace = useCurrentWorkspace();
  const resolved = useInfiniteIssueList(
    workspace.workspaceId,
    { status: "RESOLVED", limit: ISSUE_LIST_PAGE_SIZE },
    workspace.hasWorkspace,
  );
  const ignored = useInfiniteIssueList(
    workspace.workspaceId,
    { status: "IGNORED", limit: ISSUE_LIST_PAGE_SIZE },
    workspace.hasWorkspace,
  );
  const summary = useQuery({
    queryKey: ["issues", "history", workspace.workspaceId, "summary"],
    queryFn: () => getWorkspaceIssuesSummary(workspace.workspaceId),
    enabled: workspace.hasWorkspace,
  });

  if (
    workspace.isPending ||
    (workspace.hasWorkspace &&
      (resolved.isPending || ignored.isPending || summary.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (
    workspace.isError ||
    resolved.isError ||
    ignored.isError ||
    summary.isError ||
    !summary.data
  ) {
    return (
      <IssuePageMessage
        pageKey="history"
        onRetry={() =>
          void Promise.all([
            resolved.refetch(),
            ignored.refetch(),
            summary.refetch(),
          ])
        }
      />
    );
  }

  const items = [
    ...(resolved.data?.pages.flatMap((page) => page.items) ?? []),
    ...(ignored.data?.pages.flatMap((page) => page.items) ?? []),
  ].sort(
    (left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt),
  );

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("history.title")}
        description={t("history.subtitle")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("history.resolved")}
          value={String(summary.data.byStatus.resolved)}
          description={t("history.resolvedHint")}
          tone="good"
        />
        <DashboardMetricCard
          label={t("history.ignored")}
          value={String(summary.data.byStatus.ignored)}
          description={t("history.ignoredHint")}
        />
      </DashboardMetricGrid>
      <IssueRows
        title={t("history.listTitle")}
        emptyText={t("history.empty")}
        items={items}
      />
      <LoadMoreButton
        hasNextPage={resolved.hasNextPage || ignored.hasNextPage}
        isFetchingNextPage={
          resolved.isFetchingNextPage || ignored.isFetchingNextPage
        }
        onLoadMore={() =>
          void Promise.all([
            resolved.hasNextPage ? resolved.fetchNextPage() : undefined,
            ignored.hasNextPage ? ignored.fetchNextPage() : undefined,
          ])
        }
      />
    </div>
  );
}

/** SDK record가 서버에서 어디까지 처리됐는지 운영 상태를 표시합니다. */
export function IssueIntakeScreen() {
  const t = useTranslations("issues");
  const workspace = useCurrentWorkspace();
  const records = useInfiniteIssueRecordList(
    workspace.workspaceId,
    { limit: ISSUE_RECORD_PAGE_SIZE },
    workspace.hasWorkspace,
  );
  const recordItems = records.data?.pages.flatMap((page) => page.items) ?? [];
  const summary = records.data?.pages[0]?.summary;

  if (workspace.isPending || (workspace.hasWorkspace && records.isPending)) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || records.isError || !summary) {
    return (
      <IssuePageMessage
        pageKey="intake"
        onRetry={() => void records.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("intake.title")}
        description={t("intake.subtitle")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("intake.received")}
          value={String(summary.received)}
          description={t("intake.receivedHint")}
        />
        <DashboardMetricCard
          label={t("intake.evaluating")}
          value={String(summary.evaluating)}
          description={t("intake.evaluatingHint")}
        />
        <DashboardMetricCard
          label={t("intake.decided")}
          value={String(summary.decided)}
          description={t("intake.decidedHint")}
          tone="good"
        />
        <DashboardMetricCard
          label={t("intake.failed")}
          value={String(summary.failed)}
          description={t("intake.failedHint")}
          tone={summary.failed > 0 ? "bad" : "neutral"}
        />
        <DashboardMetricCard
          label={t("intake.delayed")}
          value={String(summary.delayed)}
          description={t("intake.delayedHint")}
          tone={summary.delayed > 0 ? "warning" : "neutral"}
        />
        <DashboardMetricCard
          label={t("intake.unsupported")}
          value={String(summary.unsupported)}
          description={t("intake.unsupportedHint")}
          tone={summary.unsupported > 0 ? "warning" : "neutral"}
        />
      </DashboardMetricGrid>
      <IssueRecordRows items={recordItems} emptyText={t("intake.empty")} />
      <LoadMoreButton
        hasNextPage={records.hasNextPage}
        isFetchingNextPage={records.isFetchingNextPage}
        onLoadMore={() => void records.fetchNextPage()}
      />
    </div>
  );
}

/** 이슈 판단 근거, 실행 문맥, 발생 및 평가 타임라인을 함께 표시합니다. */
export function IssueDetailOperationsScreen({ issueId }: { issueId: string }) {
  const t = useTranslations("issues");
  const format = useFormatter();
  const workspace = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const result = useIssueDetailPageData({
    workspaceId: workspace.workspaceId,
    issueId,
    occurrencesQuery: { limit: ISSUE_DETAIL_PAGE_SIZE },
    evaluationsQuery: { limit: ISSUE_DETAIL_PAGE_SIZE },
    activitiesQuery: { limit: ISSUE_DETAIL_PAGE_SIZE },
    enabled: workspace.hasWorkspace,
  });
  const statusMutation = useMutation({
    mutationFn: (status: IssueStatus) =>
      updateWorkspaceIssueStatus(workspace.workspaceId, issueId, { status }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["issues"],
      }),
  });
  const assigneeMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      updateWorkspaceIssueAssignees(workspace.workspaceId, issueId, {
        userIds,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["issues", "detail", workspace.workspaceId, issueId],
      }),
  });

  if (workspace.isPending || result.isPending) return <ActualDataPageLoading />;
  if (workspace.isError || result.isError || !result.data) {
    return (
      <IssuePageMessage
        pageKey="detail"
        onRetry={() => void result.refetch()}
      />
    );
  }

  const { issue, occurrences, evaluations, activities, assignees } =
    result.data;
  const latestEvaluation = evaluations.items[0];
  const representativeOccurrence = occurrences.items[0];
  const actions = getIssueStatusActions(issue.status);
  const currentAssigneeIds = assignees.assignees.map(
    (assignee) => assignee.userId,
  );
  const visibleAssigneeUsers = assignees.availableUsers
    .slice()
    .sort(
      (left, right) =>
        Number(currentAssigneeIds.includes(right.userId)) -
        Number(currentAssigneeIds.includes(left.userId)),
    )
    .slice(0, 8);

  function toggleAssignee(userId: string) {
    const isAssigned = currentAssigneeIds.includes(userId);
    assigneeMutation.mutate(
      isAssigned
        ? currentAssigneeIds.filter((item) => item !== userId)
        : [...currentAssigneeIds, userId],
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={issue.title}
        description={issue.summary}
        badge={
          <span className="rounded-md border px-2 py-1 text-xs font-medium">
            {t(`status.${issue.status}`)}
          </span>
        }
        actions={actions.map((action) => (
          <Button
            key={action.status}
            variant="outline"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(action.status)}
          >
            {t(action.label)}
          </Button>
        ))}
      />
      {statusMutation.isError ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {t("detail.statusUpdateError")}
        </p>
      ) : null}
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("detail.metrics.severity")}
          value={t(`severity.${issue.severity}`)}
          tone={issue.severity === "CRITICAL" ? "bad" : "warning"}
        />
        <DashboardMetricCard
          label={t("detail.metrics.occurrences")}
          value={String(issue.counts.occurrences)}
          description={t("detail.metrics.occurrencesHint")}
        />
        <DashboardMetricCard
          label={t("detail.metrics.sessions")}
          value={String(issue.counts.affectedSessions)}
          description={t("detail.metrics.sessionsHint")}
        />
        <DashboardMetricCard
          label={t("detail.metrics.blocked")}
          value={String(issue.counts.blockedOccurrences)}
          tone={issue.counts.blockedOccurrences > 0 ? "bad" : "neutral"}
        />
        <DashboardMetricCard
          label={t("detail.metrics.lastSeen")}
          value={format.dateTime(new Date(issue.lastSeenAt), {
            dateStyle: "short",
            timeStyle: "short",
          })}
          description={t("detail.metrics.lastSeenHint")}
        />
      </DashboardMetricGrid>

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList aria-label={t("detail.tabs.label")}>
            <TabsTrigger className="cursor-pointer" value="overview">
              {t("detail.tabs.overview")}
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="activity">
              {t("detail.tabs.activity", { count: activities.items.length })}
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="occurrences">
              {t("detail.tabs.occurrences", {
                count: occurrences.items.length,
              })}
            </TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="evaluations">
              {t("detail.tabs.evaluations", {
                count: evaluations.items.length,
              })}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-8">
          <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <DashboardPanel>
              <DashboardSectionHeader
                title={t("detail.judgementTitle")}
                description={t("detail.judgementDescription")}
              />
              <p className="mt-4 text-sm font-medium">
                {latestEvaluation?.summary ?? t("detail.noEvaluation")}
              </p>
              {latestEvaluation ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <DetailValue
                    label={t("detail.action")}
                    value={latestEvaluation.action}
                  />
                  <DetailValue
                    label={t("detail.reasonCode")}
                    value={latestEvaluation.reasonCode}
                  />
                  <DetailValue
                    label={t("detail.confidence")}
                    value={
                      latestEvaluation.confidence === null
                        ? "-"
                        : `${Math.round(latestEvaluation.confidence * 100)}%`
                    }
                  />
                </div>
              ) : null}
              {latestEvaluation?.evidence ? (
                <EvidenceDetails
                  label={t("detail.evidence")}
                  value={latestEvaluation.evidence}
                />
              ) : null}
            </DashboardPanel>

            <DashboardPanel>
              <DashboardSectionHeader
                title={t("detail.contextTitle")}
                description={t("detail.contextDescription")}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailValue
                  label={t("detail.agent")}
                  value={issue.agent?.name ?? "-"}
                />
                <DetailValue
                  label={t("detail.environment")}
                  value={issue.environment}
                />
                <DetailValue
                  label={t("detail.policy")}
                  value={
                    issue.policy
                      ? `${issue.policy.name} · ${issue.policy.version}`
                      : "-"
                  }
                />
                <DetailValue
                  label={t("detail.promptVersion")}
                  value={issue.promptVersion?.version ?? "-"}
                />
                <DetailValue
                  label={t("detail.reporter")}
                  value={`${issue.reporter.name} · ${issue.reporter.type}`}
                />
                <DetailValue
                  label={t("detail.category")}
                  value={t(`category.${issue.category}`)}
                />
              </div>
            </DashboardPanel>
          </section>

          <section className="grid gap-8 xl:grid-cols-2">
            <DashboardPanel>
              <DashboardSectionHeader
                title={t("detail.fingerprintTitle")}
                description={t("detail.fingerprintDescription")}
              />
              <div className="mt-4 space-y-3">
                <FingerprintValue
                  label={t("detail.stableFingerprint")}
                  value={issue.fingerprint.stable}
                />
                <FingerprintValue
                  label={t("detail.exactFingerprint")}
                  value={issue.fingerprint.exact}
                />
              </div>
            </DashboardPanel>
            <DashboardPanel>
              <DashboardSectionHeader
                title={t("detail.signalsTitle")}
                description={t("detail.signalsDescription")}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {[...issue.riskSignals, ...issue.tags].length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("detail.noSignals")}
                  </p>
                ) : (
                  [...new Set([...issue.riskSignals, ...issue.tags])].map(
                    (signal) => (
                      <span
                        className="rounded-md border bg-muted/20 px-2 py-1 text-xs"
                        key={signal}
                      >
                        {signal}
                      </span>
                    ),
                  )
                )}
              </div>
              {issue.reproductionSteps.length > 0 ? (
                <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {issue.reproductionSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : null}
            </DashboardPanel>
          </section>
        </TabsContent>

        <TabsContent value="activity">
          <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section>
              <DashboardSectionHeader
                title={t("detail.activity.title")}
                description={t("detail.activity.description")}
              />
              <ActivityTimeline
                availableUsers={assignees.availableUsers}
                issueId={issueId}
                items={activities.items}
                workspaceId={workspace.workspaceId}
              />
              <LoadMoreButton
                hasNextPage={result.activitiesPagination.hasNextPage}
                isFetchingNextPage={
                  result.activitiesPagination.isFetchingNextPage
                }
                onLoadMore={() =>
                  void result.activitiesPagination.fetchNextPage()
                }
              />
              <CommentComposer
                availableUsers={assignees.availableUsers}
                issueId={issueId}
                issueStatus={issue.status}
                onStatusChange={(status) => statusMutation.mutate(status)}
                statusPending={statusMutation.isPending}
                workspaceId={workspace.workspaceId}
              />
            </section>

            <DashboardPanel>
              <DashboardSectionHeader
                title={t("detail.assignees.title")}
                description={t("detail.assignees.description")}
              />
              <div className="mt-4 space-y-2">
                {visibleAssigneeUsers.map((user) => {
                  const isAssigned = currentAssigneeIds.includes(user.userId);
                  const hasReachedLimit =
                    !isAssigned && currentAssigneeIds.length >= 10;
                  return (
                    <div
                      className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
                      key={user.userId}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <Button
                        disabled={assigneeMutation.isPending || hasReachedLimit}
                        onClick={() => toggleAssignee(user.userId)}
                        size="sm"
                        type="button"
                        variant={isAssigned ? "default" : "outline"}
                      >
                        {isAssigned
                          ? t("detail.assignees.remove")
                          : t("detail.assignees.assign")}
                      </Button>
                    </div>
                  );
                })}
                {assignees.availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("detail.assignees.empty")}
                  </p>
                ) : null}
                {assignees.availableUsers.length > 8 ? (
                  <p className="pt-2 text-xs text-muted-foreground">
                    {t("detail.assignees.remaining", {
                      count: assignees.availableUsers.length - 8,
                    })}
                  </p>
                ) : null}
                {assigneeMutation.isError ? (
                  <p className="pt-2 text-sm text-destructive" role="alert">
                    {t("detail.assignees.error")}
                  </p>
                ) : null}
              </div>
            </DashboardPanel>
          </section>
        </TabsContent>

        <TabsContent value="occurrences">
          <section>
            <DashboardListPanel
              empty={occurrences.items.length === 0}
              emptyText={t("detail.noOccurrences")}
            >
              <h2 className="px-2 pb-2 text-sm font-semibold">
                {t("detail.occurrenceList")}
              </h2>
              {occurrences.items.map((occurrence) => (
                <Link
                  href={`/dashboard/session/detail/${occurrence.session.id}`}
                  key={occurrence.id}
                >
                  <DashboardListRow
                    title={
                      occurrence.event?.label ??
                      occurrence.session.sessionId ??
                      occurrence.id
                    }
                    description={t("detail.occurrenceDescription", {
                      environment: occurrence.environment,
                      detectedAt: format.dateTime(
                        new Date(occurrence.detectedAt),
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      ),
                    })}
                    value={
                      occurrence.isBlocked
                        ? t("detail.blockedYes")
                        : t("detail.blockedNo")
                    }
                    tone={occurrence.isBlocked ? "bad" : "neutral"}
                  />
                </Link>
              ))}
              {representativeOccurrence?.evidence ? (
                <EvidenceDetails
                  label={t("detail.representativeEvidence")}
                  value={representativeOccurrence.evidence}
                />
              ) : null}
            </DashboardListPanel>
            <LoadMoreButton
              hasNextPage={result.occurrencesPagination.hasNextPage}
              isFetchingNextPage={
                result.occurrencesPagination.isFetchingNextPage
              }
              onLoadMore={() =>
                void result.occurrencesPagination.fetchNextPage()
              }
            />
          </section>
        </TabsContent>

        <TabsContent value="evaluations">
          <section>
            <DashboardListPanel
              empty={evaluations.items.length === 0}
              emptyText={t("detail.noEvaluations")}
            >
              <h2 className="px-2 pb-2 text-sm font-semibold">
                {t("detail.evaluationList")}
              </h2>
              {evaluations.items.map((evaluation) => (
                <DashboardListRow
                  key={evaluation.id}
                  title={evaluation.summary}
                  description={t("detail.evaluationDescription", {
                    evaluator: evaluation.evaluator.name,
                    pipeline: evaluation.pipeline,
                  })}
                  value={evaluation.action}
                  tone={
                    evaluation.pipeline === "RESOLUTION" ? "good" : "neutral"
                  }
                />
              ))}
            </DashboardListPanel>
            <LoadMoreButton
              hasNextPage={result.evaluationsPagination.hasNextPage}
              isFetchingNextPage={
                result.evaluationsPagination.isFetchingNextPage
              }
              onLoadMore={() =>
                void result.evaluationsPagination.fetchNextPage()
              }
            />
          </section>
        </TabsContent>
      </Tabs>

      <DashboardPanel>
        <DashboardSectionHeader
          title={t("detail.nextAction")}
          description={t("detail.nextActionDescription")}
        />
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t(`detail.nextActionByStatus.${issue.status}`)}
        </p>
      </DashboardPanel>
    </div>
  );
}

/** 이전 경로가 남아 있어도 같은 실제 데이터 화면을 사용합니다. */
export const IssueFingerprintsScreen = IssuePatternsScreen;

/** 차단 여부는 독립 메뉴 대신 이슈 필터로 유지합니다. */
export function BlockedIssuesScreen() {
  return (
    <WorkflowIssueListScreen
      pageKey="blocked"
      query={{ isBlocked: true, limit: 100 }}
    />
  );
}

function WorkflowIssueListScreen({
  pageKey,
  query,
}: {
  pageKey: "review" | "investigating" | "changeImpact" | "blocked";
  query: GetIssuesQueryInput;
}) {
  const t = useTranslations("issues");
  const workspace = useCurrentWorkspace();
  const issues = useInfiniteIssueList(
    workspace.workspaceId,
    { ...query, limit: ISSUE_LIST_PAGE_SIZE },
    workspace.hasWorkspace,
  );
  const summary = useQuery({
    queryKey: ["issues", "workflow", workspace.workspaceId, "summary"],
    queryFn: () => getWorkspaceIssuesSummary(workspace.workspaceId),
    enabled: workspace.hasWorkspace,
  });
  const items = issues.data?.pages.flatMap((page) => page.items) ?? [];

  if (
    workspace.isPending ||
    issues.isPending ||
    (workspace.hasWorkspace && summary.isPending)
  ) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || issues.isError || summary.isError || !summary.data) {
    return (
      <IssuePageMessage
        pageKey={pageKey}
        onRetry={() => void Promise.all([issues.refetch(), summary.refetch()])}
      />
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t(`${pageKey}.title`)}
        description={t(`${pageKey}.subtitle`)}
      />
      <IssueSummaryMetrics summary={summary.data} />
      <IssueRows
        title={t(`${pageKey}.listTitle`)}
        emptyText={t(`${pageKey}.empty`)}
        items={items}
      />
      <LoadMoreButton
        hasNextPage={issues.hasNextPage}
        isFetchingNextPage={issues.isFetchingNextPage}
        onLoadMore={() => void issues.fetchNextPage()}
      />
    </div>
  );
}

function IssueSummaryMetrics({
  summary,
  affectedEnvironments,
}: {
  summary: GetIssuesSummaryResponseDto;
  affectedEnvironments?: number;
}) {
  const t = useTranslations("issues");

  return (
    <DashboardMetricGrid>
      <DashboardMetricCard
        label={t("metrics.open")}
        value={String(summary.byStatus.open)}
        description={t("metrics.openHint")}
      />
      <DashboardMetricCard
        label={t("metrics.investigating")}
        value={String(summary.byStatus.investigating)}
        description={t("metrics.investigatingHint")}
        tone="warning"
      />
      <DashboardMetricCard
        label={t("metrics.critical")}
        value={String(summary.bySeverity.critical)}
        description={t("metrics.criticalHint")}
        tone={summary.bySeverity.critical > 0 ? "bad" : "neutral"}
      />
      <DashboardMetricCard
        label={t("metrics.occurrences")}
        value={String(summary.occurrences)}
        description={t("metrics.occurrencesHint")}
      />
      <DashboardMetricCard
        label={
          affectedEnvironments === undefined
            ? t("metrics.affectedSessions")
            : t("metrics.environments")
        }
        value={String(affectedEnvironments ?? summary.affectedSessions)}
        description={
          affectedEnvironments === undefined
            ? t("metrics.affectedSessionsHint")
            : t("metrics.environmentsHint")
        }
      />
    </DashboardMetricGrid>
  );
}

function IssueRows({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: IssueItem[];
}) {
  const t = useTranslations("issues");
  const format = useFormatter();

  return (
    <div>
      <DashboardSectionHeader title={title} />
      <DashboardListPanel
        className="mt-3"
        empty={items.length === 0}
        emptyText={emptyText}
      >
        {items.map((issue) => (
          <Link href={`/issues/${issue.id}`} key={issue.id}>
            <DashboardListRow
              title={issue.title}
              description={t("list.rowDescription", {
                agent: issue.agent?.name ?? t("list.unknownAgent"),
                environment: issue.environment,
                occurrences: issue.occurrenceCount,
                lastSeen: format.dateTime(new Date(issue.lastSeenAt), {
                  dateStyle: "short",
                  timeStyle: "short",
                }),
              })}
              value={t(`severity.${issue.severity}`)}
              tone={
                issue.severity === "CRITICAL"
                  ? "bad"
                  : issue.severity === "WARNING"
                    ? "warning"
                    : "neutral"
              }
            />
          </Link>
        ))}
      </DashboardListPanel>
    </div>
  );
}

function IssueRecordRows({
  items,
  emptyText,
}: {
  items: IssueRecordItem[];
  emptyText: string;
}) {
  const t = useTranslations("issues");
  const format = useFormatter();

  return (
    <DashboardListPanel empty={items.length === 0} emptyText={emptyText}>
      {items.map((record) => {
        const row = (
          <DashboardListRow
            title={t("intake.recordTitle", {
              detectionType: record.detectionType,
              agent: record.clientAgentId,
            })}
            description={t("intake.recordDescription", {
              environment: record.environment,
              detectedAt: format.dateTime(new Date(record.detectedAt), {
                dateStyle: "short",
                timeStyle: "short",
              }),
              attempts: record.processing.attemptCount,
              error:
                record.processing.lastErrorCode ??
                record.decision?.reasonCode ??
                "-",
            })}
            value={t(`processingStatus.${record.processing.status}`)}
            tone={
              record.processing.status === "FAILED" ||
              record.processing.isDelayed
                ? "bad"
                : record.processing.status === "DECIDED"
                  ? "good"
                  : "warning"
            }
          />
        );
        return record.decision?.matchedIssueId ? (
          <Link
            href={`/issues/${record.decision.matchedIssueId}`}
            key={record.id}
          >
            {row}
          </Link>
        ) : (
          <div key={record.id}>{row}</div>
        );
      })}
    </DashboardListPanel>
  );
}

function IssuePageMessage({
  pageKey,
  onRetry,
}: {
  pageKey:
    | "overview"
    | "review"
    | "investigating"
    | "recovery"
    | "patterns"
    | "changeImpact"
    | "history"
    | "intake"
    | "blocked"
    | "detail";
  onRetry?: () => void;
}) {
  const t = useTranslations("issues");
  return (
    <ActualDataPageMessage
      pageTitle={t(`${pageKey}.title`)}
      pageDescription={t(`${pageKey}.subtitle`)}
      title={t("error.title")}
      description={t("error.description")}
      action={onRetry ? t("error.retry") : undefined}
      onRetry={onRetry}
    />
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function FingerprintValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <code className="mt-1 block break-all rounded-md border bg-muted/20 p-2 text-xs">
        {value}
      </code>
    </div>
  );
}

function EvidenceDetails({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown>;
}) {
  return (
    <details className="mt-4 rounded-md border p-3">
      <summary className="cursor-pointer text-xs font-medium">{label}</summary>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ActivityTimeline({
  items,
  availableUsers,
  workspaceId,
  issueId,
}: {
  items: IssueActivityItem[];
  availableUsers: MentionUser[];
  workspaceId: string;
  issueId: string;
}) {
  const t = useTranslations("issues");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingMentionIds, setEditingMentionIds] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const updateMutation = useMutation({
    mutationFn: (input: {
      commentId: string;
      body: string;
      mentionedUserIds: string[];
    }) =>
      updateWorkspaceIssueComment(workspaceId, issueId, input.commentId, {
        body: input.body,
        mentionedUserIds: input.mentionedUserIds,
      }),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({
        queryKey: ["issues", "detail", workspaceId, issueId],
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      deleteWorkspaceIssueComment(workspaceId, issueId, commentId),
    onSuccess: async () => {
      setDeleteConfirmId(null);
      await queryClient.invalidateQueries({
        queryKey: ["issues", "detail", workspaceId, issueId],
      });
    },
  });

  function startEditing(activity: IssueActivityItem) {
    setDeleteConfirmId(null);
    setEditingId(activity.id);
    setEditingBody(activity.body ?? "");
    setEditingMentionIds(activity.mentions.map((mention) => mention.userId));
  }

  function saveEditing(commentId: string) {
    if (editingBody.trim().length === 0 || updateMutation.isPending) return;
    updateMutation.mutate({
      commentId,
      body: editingBody,
      mentionedUserIds: getActiveMentionIds(
        editingBody,
        editingMentionIds,
        availableUsers,
      ),
    });
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 border-t pt-5 text-sm text-muted-foreground">
        {t("detail.activity.empty")}
      </p>
    );
  }

  return (
    <ol className="mt-6 ml-3 border-l">
      {items
        .slice()
        .reverse()
        .map((activity) => {
          const createdAt = format.dateTime(new Date(activity.createdAt), {
            dateStyle: "medium",
            timeStyle: "short",
          });
          if (activity.type !== "COMMENTED") {
            return (
              <li className="relative pb-5 pl-7" key={activity.id}>
                <span className="absolute -left-2 top-0.5 flex size-4 items-center justify-center rounded-full border bg-background">
                  <span className="size-1.5 rounded-full bg-muted-foreground" />
                </span>
                <p className="text-sm text-muted-foreground">
                  {getActivityDescription(activity, t)}{" "}
                  <time className="text-xs">{createdAt}</time>
                </p>
                {activity.body ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {activity.body}
                  </p>
                ) : null}
              </li>
            );
          }

          const isEditing = editingId === activity.id;
          const isConfirmingDelete = deleteConfirmId === activity.id;
          return (
            <li className="relative pb-6 pl-7" key={activity.id}>
              <span className="absolute -left-2 top-4 size-4 rounded-full border bg-background" />
              <article className="rounded-md border bg-background">
                <header className="flex min-h-10 items-center justify-between gap-3 rounded-t-md border-b bg-muted/30 px-3 py-2">
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-semibold">{activity.actor.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {createdAt}
                      {activity.editedAt
                        ? ` · ${t("detail.activity.edited")}`
                        : ""}
                    </span>
                  </p>
                  {activity.permissions.canEdit && !isEditing ? (
                    <div className="flex shrink-0 items-center">
                      <Button
                        aria-label={t("detail.activity.edit")}
                        onClick={() => startEditing(activity)}
                        size="icon"
                        title={t("detail.activity.edit")}
                        type="button"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        aria-label={t("detail.activity.delete")}
                        onClick={() => setDeleteConfirmId(activity.id)}
                        size="icon"
                        title={t("detail.activity.delete")}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </header>
                <div className="p-4">
                  {activity.deletedAt ? (
                    <p className="text-sm italic text-muted-foreground">
                      {t("detail.activity.deleted")}
                    </p>
                  ) : isEditing ? (
                    <div className="space-y-3">
                      <MentionEditor
                        availableUsers={availableUsers}
                        body={editingBody}
                        mentionedUserIds={editingMentionIds}
                        onBodyChange={setEditingBody}
                        onMentionedUserIdsChange={setEditingMentionIds}
                        placeholder={t("detail.activity.commentPlaceholder")}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => setEditingId(null)}
                          type="button"
                          variant="outline"
                        >
                          {t("detail.activity.cancel")}
                        </Button>
                        <Button
                          disabled={
                            editingBody.trim().length === 0 ||
                            updateMutation.isPending
                          }
                          onClick={() => saveEditing(activity.id)}
                          type="button"
                        >
                          {t("detail.activity.save")}
                        </Button>
                      </div>
                      {updateMutation.isError ? (
                        <p className="text-sm text-destructive" role="alert">
                          {t("detail.activity.editError")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <CommentBody
                      body={activity.body ?? ""}
                      mentions={activity.mentions}
                    />
                  )}
                  {isConfirmingDelete && !activity.deletedAt ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                      <p className="text-sm text-muted-foreground">
                        {t("detail.activity.deleteConfirm")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setDeleteConfirmId(null)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {t("detail.activity.cancel")}
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(activity.id)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {t("detail.activity.delete")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {deleteMutation.isError && isConfirmingDelete ? (
                    <p className="mt-3 text-sm text-destructive" role="alert">
                      {t("detail.activity.deleteError")}
                    </p>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
    </ol>
  );
}

function CommentComposer({
  workspaceId,
  issueId,
  issueStatus,
  availableUsers,
  statusPending,
  onStatusChange,
}: {
  workspaceId: string;
  issueId: string;
  issueStatus: IssueStatus;
  availableUsers: MentionUser[];
  statusPending: boolean;
  onStatusChange: (status: IssueStatus) => void;
}) {
  const t = useTranslations("issues");
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const commentMutation = useMutation({
    mutationFn: () =>
      createWorkspaceIssueComment(workspaceId, issueId, {
        body,
        mentionedUserIds: getActiveMentionIds(
          body,
          mentionedUserIds,
          availableUsers,
        ),
      }),
    onSuccess: async () => {
      setBody("");
      setMentionedUserIds([]);
      await queryClient.invalidateQueries({
        queryKey: ["issues", "detail", workspaceId, issueId],
      });
    },
  });
  const resolutionTarget =
    issueStatus === "RESOLVED"
      ? ("OPEN" as const)
      : issueStatus === "OPEN" || issueStatus === "INVESTIGATING"
        ? ("RESOLVED" as const)
        : null;

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length === 0 || commentMutation.isPending) return;
    commentMutation.mutate();
  }

  return (
    <form
      className="mt-2 rounded-md border bg-background"
      onSubmit={submitComment}
    >
      <div className="rounded-t-md border-b bg-muted/20 px-4 py-3">
        <p className="text-sm font-semibold">
          {t("detail.activity.addComment")}
        </p>
      </div>
      <div className="p-4">
        <MentionEditor
          availableUsers={availableUsers}
          body={body}
          mentionedUserIds={mentionedUserIds}
          onBodyChange={setBody}
          onMentionedUserIdsChange={setMentionedUserIds}
          placeholder={t("detail.activity.commentPlaceholder")}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t("detail.activity.mentionHint")}
          </p>
          <div className="flex gap-2">
            {resolutionTarget ? (
              <Button
                disabled={statusPending}
                onClick={() => onStatusChange(resolutionTarget)}
                type="button"
                variant="outline"
              >
                {resolutionTarget === "RESOLVED" ? (
                  <CheckCircle2 className="mr-2 size-4" />
                ) : (
                  <X className="mr-2 size-4" />
                )}
                {resolutionTarget === "RESOLVED"
                  ? t("detail.activity.markResolved")
                  : t("detail.activity.markUnresolved")}
              </Button>
            ) : null}
            <Button
              disabled={body.trim().length === 0 || commentMutation.isPending}
              type="submit"
            >
              {commentMutation.isPending
                ? t("detail.activity.commentSaving")
                : t("detail.activity.commentSubmit")}
            </Button>
          </div>
        </div>
        {commentMutation.isError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {t("detail.activity.commentError")}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function MentionEditor({
  body,
  mentionedUserIds,
  availableUsers,
  placeholder,
  onBodyChange,
  onMentionedUserIdsChange,
}: {
  body: string;
  mentionedUserIds: string[];
  availableUsers: MentionUser[];
  placeholder: string;
  onBodyChange: (value: string) => void;
  onMentionedUserIdsChange: (value: string[]) => void;
}) {
  const t = useTranslations("issues");
  const mentionQuery = getMentionQuery(body);
  const suggestions =
    mentionQuery === null
      ? []
      : availableUsers
          .filter((user) => {
            const query = mentionQuery.toLocaleLowerCase();
            return (
              user.name.toLocaleLowerCase().includes(query) ||
              user.email.toLocaleLowerCase().includes(query)
            );
          })
          .slice(0, 5);

  function selectMention(user: MentionUser) {
    const match = body.match(/(^|\s)@([^@\n]*)$/);
    if (!match || match.index === undefined) return;
    const prefix = body.slice(0, match.index) + match[1];
    onBodyChange(`${prefix}@${user.name} `);
    onMentionedUserIdsChange([...new Set([...mentionedUserIds, user.userId])]);
  }

  return (
    <div className="relative">
      <Textarea
        aria-label={t("detail.activity.commentLabel")}
        maxLength={10_000}
        onChange={(event) => onBodyChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        value={body}
      />
      {suggestions.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((user) => (
            <button
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
              key={user.userId}
              onClick={() => selectMention(user)}
              type="button"
            >
              <span className="text-sm font-medium">@{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CommentBody({
  body,
  mentions,
}: {
  body: string;
  mentions: IssueActivityItem["mentions"];
}) {
  if (mentions.length === 0) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-6">
        {body}
      </p>
    );
  }
  const names = mentions.map((mention) => mention.name);
  const pattern = new RegExp(
    `(@(?:${names.map(escapeRegExp).join("|")}))`,
    "g",
  );
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6">
      {body.split(pattern).map((part, index) =>
        names.some((name) => part === `@${name}`) ? (
          <span
            className="rounded bg-blue-50 px-0.5 font-medium text-blue-700"
            key={`${part}-${index}`}
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function getMentionQuery(body: string): string | null {
  if (body.endsWith(" ")) return null;
  const match = body.match(/(?:^|\s)@([^@\n]*)$/);
  return match?.[1] ?? null;
}

function getActiveMentionIds(
  body: string,
  mentionedUserIds: string[],
  availableUsers: MentionUser[],
) {
  const userById = new Map(availableUsers.map((user) => [user.userId, user]));
  return mentionedUserIds.filter((userId) => {
    const user = userById.get(userId);
    return user ? body.includes(`@${user.name}`) : false;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActivityDescription(
  activity: IssueActivityItem,
  t: ReturnType<typeof useTranslations>,
) {
  const targetName =
    readActivityMetadata(activity, "targetName") ??
    t("detail.activity.unknownTarget");
  const previousStatus = translateActivityStatus(
    readActivityMetadata(activity, "previousStatus"),
    t,
  );
  const nextStatus = translateActivityStatus(
    readActivityMetadata(activity, "nextStatus"),
    t,
  );
  const previousStatusValue = readActivityMetadata(activity, "previousStatus");
  const nextStatusValue = readActivityMetadata(activity, "nextStatus");
  const actor = activity.actor.name;

  if (nextStatusValue === "RESOLVED") {
    return t("detail.activity.events.resolved", { actor });
  }
  if (previousStatusValue === "RESOLVED" && nextStatusValue === "OPEN") {
    return t("detail.activity.events.unresolved", { actor });
  }

  switch (activity.type) {
    case "CREATED":
      return t("detail.activity.events.created", { actor });
    case "REOPENED":
      return t("detail.activity.events.reopened", { actor });
    case "STATUS_CHANGED":
      return t("detail.activity.events.statusChanged", {
        actor,
        previousStatus,
        nextStatus,
      });
    case "ASSIGNED":
      return t("detail.activity.events.assigned", { actor, targetName });
    case "UNASSIGNED":
      return t("detail.activity.events.unassigned", { actor, targetName });
    case "SEVERITY_CHANGED":
      return t("detail.activity.events.severityChanged", { actor });
    case "LABEL_ADDED":
      return t("detail.activity.events.labelAdded", { actor });
    case "LABEL_REMOVED":
      return t("detail.activity.events.labelRemoved", { actor });
    case "TAG_ADDED":
      return t("detail.activity.events.tagAdded", { actor });
    default:
      return t("detail.activity.events.updated", { actor });
  }
}

function readActivityMetadata(
  activity: IssueActivityItem,
  key: string,
): string | null {
  const value = activity.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function translateActivityStatus(
  status: string | null,
  t: ReturnType<typeof useTranslations>,
) {
  if (
    status === "OPEN" ||
    status === "INVESTIGATING" ||
    status === "RESOLVED" ||
    status === "IGNORED"
  ) {
    return t(`status.${status}`);
  }
  return status ?? "-";
}

function getIssueStatusActions(status: IssueStatus) {
  if (status === "OPEN") {
    return [
      {
        status: "INVESTIGATING" as const,
        label: "detail.actions.investigate",
      },
      { status: "IGNORED" as const, label: "detail.actions.ignore" },
    ];
  }
  if (status === "INVESTIGATING") {
    return [
      { status: "OPEN" as const, label: "detail.actions.returnToReview" },
      { status: "IGNORED" as const, label: "detail.actions.ignore" },
    ];
  }
  if (status === "IGNORED") {
    return [{ status: "OPEN" as const, label: "detail.actions.reopen" }];
  }
  return [];
}

function useInfiniteIssueList(
  workspaceId: string,
  query: GetIssuesQueryInput,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: ["issues", "infinite-list", workspaceId, query],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      listWorkspaceIssues(workspaceId, {
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && workspaceId.length > 0,
  });
}

function useInfiniteIssueRecordList(
  workspaceId: string,
  query: IssueRecordsQuery,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: ["issues", "infinite-records", workspaceId, query],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      listWorkspaceIssueRecords(workspaceId, {
        ...query,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && workspaceId.length > 0,
  });
}

function LoadMoreButton({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("issues.pagination");

  if (!hasNextPage) return null;

  return (
    <div className="flex justify-center pt-3">
      <Button
        disabled={isFetchingNextPage}
        onClick={onLoadMore}
        type="button"
        variant="outline"
      >
        {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
      </Button>
    </div>
  );
}

function compareIssuePriority(left: IssueItem, right: IssueItem) {
  const severityRank = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const severityDifference =
    severityRank[left.severity] - severityRank[right.severity];
  if (severityDifference !== 0) return severityDifference;
  if (left.occurrenceCount !== right.occurrenceCount) {
    return right.occurrenceCount - left.occurrenceCount;
  }
  return Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
}

function buildFingerprintGroups(items: IssueItem[]) {
  return Array.from(
    items
      .reduce((map, issue) => {
        const group = map.get(issue.fingerprint) ?? {
          fingerprint: issue.fingerprint,
          title: issue.title,
          representativeIssueId: issue.id,
          issueCount: 0,
          occurrenceCount: 0,
          lastSeenAt: issue.lastSeenAt,
          agents: new Set<string>(),
        };
        group.issueCount += 1;
        group.occurrenceCount += issue.occurrenceCount;
        if (issue.agent) group.agents.add(issue.agent.id);
        if (issue.lastSeenAt > group.lastSeenAt) {
          group.lastSeenAt = issue.lastSeenAt;
          group.title = issue.title;
          group.representativeIssueId = issue.id;
        }
        map.set(issue.fingerprint, group);
        return map;
      }, new Map<string, { fingerprint: string; title: string; representativeIssueId: string; issueCount: number; occurrenceCount: number; lastSeenAt: string; agents: Set<string> }>())
      .values(),
  ).sort((left, right) => right.occurrenceCount - left.occurrenceCount);
}

function buildIssueTrend(items: IssueItem[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const counts = new Map(days.map((date) => [date, 0]));
  for (const issue of items) {
    const date = issue.firstSeenAt.slice(0, 10);
    if (counts.has(date)) counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

function buildAffectedScopes(items: IssueItem[], unknownAgentLabel: string) {
  const scopes = new Map<
    string,
    {
      key: string;
      agent: string;
      environments: Set<string>;
      issueCount: number;
      occurrenceCount: number;
      criticalCount: number;
    }
  >();

  for (const issue of items) {
    const key = issue.agent?.id ?? `unknown:${issue.environment}`;
    const scope = scopes.get(key) ?? {
      key,
      agent: issue.agent?.name ?? unknownAgentLabel,
      environments: new Set<string>(),
      issueCount: 0,
      occurrenceCount: 0,
      criticalCount: 0,
    };
    scope.environments.add(issue.environment);
    scope.issueCount += 1;
    scope.occurrenceCount += issue.occurrenceCount;
    if (issue.severity === "CRITICAL") scope.criticalCount += 1;
    scopes.set(key, scope);
  }

  return Array.from(scopes.values())
    .sort(
      (left, right) =>
        right.criticalCount - left.criticalCount ||
        right.occurrenceCount - left.occurrenceCount,
    )
    .map((scope) => ({
      ...scope,
      environments: Array.from(scope.environments).sort(),
    }));
}
