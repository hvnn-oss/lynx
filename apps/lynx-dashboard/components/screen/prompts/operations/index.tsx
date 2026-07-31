"use client";

import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { formatDateTime } from "@/components/ui/operations/format";
import { OperationsSplitDiff } from "@/components/ui/operations/split-diff";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import { listWorkspaceIssues } from "@/lib/issues";
import {
  comparePromptVersions,
  getPrompt,
  listPromptDeployments,
  listPromptExperiments,
  listPrompts,
  listPromptVersions,
} from "@/lib/prompts";

type PromptItem = Awaited<ReturnType<typeof listPrompts>>["items"][number];
type PromptVersion = Awaited<
  ReturnType<typeof listPromptVersions>
>["items"][number];

function usePromptCatalog() {
  const workspace = useCurrentWorkspace();
  const prompts = useQuery({
    queryKey: ["prompts", workspace.workspaceId],
    queryFn: () => listPrompts(workspace.workspaceId),
    enabled: workspace.hasWorkspace,
  });

  return {
    workspace,
    prompts: prompts.data?.items ?? [],
    isPending:
      workspace.isPending || (workspace.hasWorkspace && prompts.isPending),
    isError: workspace.isError || prompts.isError,
    refetch: prompts.refetch,
  };
}

/** 서버가 제공하는 프롬프트 초안 목록과 리비전만 요약합니다. */
export function PromptsOverviewScreen() {
  const t = useTranslations("prompts");
  const data = usePromptCatalog();

  if (data.isPending) return <ActualDataPageLoading />;
  if (data.isError)
    return <PromptMessage title={t("overview.title")} onRetry={data.refetch} />;

  const promptsWithContent = data.prompts.filter(
    (prompt) => prompt.draftContent.trim().length > 0,
  ).length;
  const revisedDrafts = data.prompts.filter(
    (prompt) => prompt.draftRevision > 1,
  ).length;
  const averageRevision =
    data.prompts.length === 0
      ? 0
      : Math.round(
          data.prompts.reduce((sum, prompt) => sum + prompt.draftRevision, 0) /
            data.prompts.length,
        );

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("overview.title")}
        description={t("overview.subtitle")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("metrics.total")}
          value={String(data.prompts.length)}
          description={t("metrics.totalHint")}
        />
        <DashboardMetricCard
          label={t("actual.withContent")}
          value={String(promptsWithContent)}
          description={t("actual.withContentHint")}
        />
        <DashboardMetricCard
          label={t("actual.averageRevision")}
          value={String(averageRevision)}
          description={t("actual.averageRevisionHint")}
        />
        <DashboardMetricCard
          label={t("actual.revisedDrafts")}
          value={String(revisedDrafts)}
          description={t("actual.revisedDraftsHint")}
        />
      </DashboardMetricGrid>
      <PromptList prompts={data.prompts} />
    </div>
  );
}

/** 모든 프롬프트의 불변 버전 이력을 최근 순서로 합쳐 보여줍니다. */
export function PromptChangesScreen() {
  const t = useTranslations("prompts");
  const data = usePromptCatalog();
  const versionQueries = useQueries({
    queries: data.prompts.slice(0, 20).map((prompt) => ({
      queryKey: ["prompts", prompt.id, "versions"],
      queryFn: () => listPromptVersions(data.workspace.workspaceId, prompt.id),
      enabled: data.workspace.hasWorkspace,
    })),
  });

  if (
    data.isPending ||
    (data.prompts.length > 0 && versionQueries.some((query) => query.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (data.isError || versionQueries.some((query) => query.isError)) {
    return <PromptMessage title={t("changes.title")} onRetry={data.refetch} />;
  }

  const promptNames = new Map(
    data.prompts.map((prompt) => [prompt.id, prompt.name]),
  );
  const versions = versionQueries
    .flatMap((query) => query.data?.items ?? [])
    .sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )
    .slice(0, 20);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("changes.title")}
        description={t("changes.subtitle")}
      />
      <DashboardListPanel
        empty={versions.length === 0}
        emptyText={t("changes.empty")}
      >
        {versions.map((version) => (
          <DashboardListRow
            key={version.id}
            title={`${promptNames.get(version.promptId) ?? t("actual.unknownPrompt")} · ${version.version}`}
            description={
              version.changeReason?.trim() || t("actual.noChangeReason")
            }
            value={formatDateTime(version.createdAt)}
          />
        ))}
      </DashboardListPanel>
    </div>
  );
}

/** 회귀 탐지 파이프라인이 만든 실제 PROMPT_REGRESSION 이슈를 조회합니다. */
export function PromptRegressionsScreen() {
  const t = useTranslations("prompts");
  const workspace = useCurrentWorkspace();
  const issues = useQuery({
    queryKey: ["prompts", "regressions", workspace.workspaceId],
    queryFn: () =>
      listWorkspaceIssues(workspace.workspaceId, {
        category: "PROMPT_REGRESSION",
        limit: 100,
      }),
    enabled: workspace.hasWorkspace,
  });

  if (workspace.isPending || (workspace.hasWorkspace && issues.isPending)) {
    return <ActualDataPageLoading />;
  }
  if (workspace.isError || issues.isError) {
    return <PromptMessage title={t("regressions.title")} />;
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("regressions.title")}
        description={t("regressions.subtitle")}
      />
      <DashboardListPanel
        empty={(issues.data?.items.length ?? 0) === 0}
        emptyText={t("regressions.empty")}
      >
        {issues.data?.items.slice(0, 8).map((issue) => (
          <Link href={`/issues/tracker/${issue.id}`} key={issue.id}>
            <DashboardListRow
              title={issue.title}
              description={t("actual.regressionDescription", {
                occurrences: issue.occurrenceCount,
                environment: issue.environment,
              })}
              value={issue.severity}
              tone={issue.severity === "CRITICAL" ? "bad" : "warning"}
            />
          </Link>
        ))}
      </DashboardListPanel>
    </div>
  );
}

/** 최근 두 불변 버전을 서버 diff API로 비교합니다. */
export function PromptCompareScreen() {
  const t = useTranslations("prompts");
  const data = usePromptCatalog();
  const prompt = data.prompts[0];
  const versions = useQuery({
    queryKey: ["prompts", prompt?.id, "versions"],
    queryFn: () => listPromptVersions(data.workspace.workspaceId, prompt!.id),
    enabled: Boolean(prompt && data.workspace.hasWorkspace),
  });
  const latest = versions.data?.items[0];
  const previous = versions.data?.items[1];
  const comparison = useQuery({
    queryKey: ["prompts", prompt?.id, "compare", previous?.id, latest?.id],
    queryFn: () =>
      comparePromptVersions(
        data.workspace.workspaceId,
        prompt!.id,
        previous!.id,
        latest!.id,
      ),
    enabled: Boolean(prompt && previous && latest),
  });

  if (
    data.isPending ||
    (Boolean(prompt) && versions.isPending) ||
    (Boolean(previous && latest) && comparison.isPending)
  ) {
    return <ActualDataPageLoading />;
  }
  if (data.isError || versions.isError || comparison.isError) {
    return <PromptMessage title={t("compare.title")} onRetry={data.refetch} />;
  }
  if (!prompt || !latest || !previous || !comparison.data) {
    return (
      <PromptEmptyMessage
        pageTitle={t("compare.title")}
        pageDescription={t("compare.subtitle")}
        title={t("actual.compareUnavailable")}
      />
    );
  }

  const changedLines = comparison.data.changes.filter(
    (change) => change.type !== "UNCHANGED",
  ).length;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("compare.title")}
        description={`${prompt.name} · ${previous.version} → ${latest.version}`}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("actual.changedLines")}
          value={String(changedLines)}
          description={t("actual.changedLinesHint")}
        />
        <DashboardMetricCard
          label={t("actual.previousVersion")}
          value={previous.version}
          description={formatDateTime(previous.createdAt)}
        />
        <DashboardMetricCard
          label={t("actual.latestVersion")}
          value={latest.version}
          description={formatDateTime(latest.createdAt)}
        />
      </DashboardMetricGrid>
      <DashboardPanel>
        <OperationsSplitDiff
          changes={comparison.data.changes}
          beforeLabel={previous.version}
          afterLabel={latest.version}
        />
      </DashboardPanel>
    </div>
  );
}

/** 환경·에이전트별 실제 프롬프트 배포 이력을 표시합니다. */
export function PromptDeploymentsScreen() {
  const t = useTranslations("prompts");
  const data = usePromptCatalog();
  const deploymentQueries = useQueries({
    queries: data.prompts.slice(0, 20).map((prompt) => ({
      queryKey: ["prompts", prompt.id, "deployments"],
      queryFn: () =>
        listPromptDeployments(data.workspace.workspaceId, prompt.id),
      enabled: data.workspace.hasWorkspace,
    })),
  });

  if (
    data.isPending ||
    (data.prompts.length > 0 &&
      deploymentQueries.some((query) => query.isPending))
  ) {
    return <ActualDataPageLoading />;
  }
  if (data.isError || deploymentQueries.some((query) => query.isError)) {
    return (
      <PromptMessage title={t("deployments.title")} onRetry={data.refetch} />
    );
  }

  const promptNames = new Map(
    data.prompts.map((prompt) => [prompt.id, prompt.name]),
  );
  const deployments = deploymentQueries
    .flatMap((query) => query.data?.items ?? [])
    .sort(
      (left, right) =>
        Date.parse(right.deployedAt) - Date.parse(left.deployedAt),
    )
    .slice(0, 20);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={t("deployments.title")}
        description={t("deployments.subtitle")}
      />
      <DashboardListPanel
        empty={deployments.length === 0}
        emptyText={t("deployments.empty")}
      >
        {deployments.map((deployment) => (
          <DashboardListRow
            key={deployment.id}
            title={`${promptNames.get(deployment.promptId) ?? t("actual.unknownPrompt")} · ${deployment.version}`}
            description={t("actual.deploymentDescription", {
              environment: deployment.environment,
              agent: deployment.agentId ?? t("actual.allAgents"),
            })}
            value={
              deployment.active ? t("actual.active") : t("actual.inactive")
            }
            tone={deployment.active ? "good" : "neutral"}
          />
        ))}
      </DashboardListPanel>
    </div>
  );
}

/** 초안, 불변 버전, 배포, A/B 실험을 한 프롬프트 상세 화면에 모읍니다. */
export function PromptDetailScreen({ promptId }: { promptId: string }) {
  const t = useTranslations("prompts");
  const workspace = useCurrentWorkspace();
  const prompt = useQuery({
    queryKey: ["prompts", promptId],
    queryFn: () => getPrompt(workspace.workspaceId, promptId),
    enabled: workspace.hasWorkspace,
  });
  const versions = useQuery({
    queryKey: ["prompts", promptId, "versions"],
    queryFn: () => listPromptVersions(workspace.workspaceId, promptId),
    enabled: workspace.hasWorkspace,
  });
  const deployments = useQuery({
    queryKey: ["prompts", promptId, "deployments"],
    queryFn: () => listPromptDeployments(workspace.workspaceId, promptId),
    enabled: workspace.hasWorkspace,
  });
  const experiments = useQuery({
    queryKey: ["prompts", promptId, "experiments"],
    queryFn: () => listPromptExperiments(workspace.workspaceId, promptId),
    enabled: workspace.hasWorkspace,
  });

  const isPending =
    workspace.isPending ||
    (workspace.hasWorkspace &&
      (prompt.isPending ||
        versions.isPending ||
        deployments.isPending ||
        experiments.isPending));
  if (isPending) return <ActualDataPageLoading />;
  if (
    workspace.isError ||
    prompt.isError ||
    versions.isError ||
    deployments.isError ||
    experiments.isError
  ) {
    return <PromptMessage title={t("actual.promptNotFound")} />;
  }

  const promptData = prompt.data;
  if (!promptData) return <PromptMessage title={t("actual.promptNotFound")} />;

  const activeDeployments =
    deployments.data?.items.filter((deployment) => deployment.active).length ??
    0;
  const activeExperiments =
    experiments.data?.items.filter(
      (experiment) => experiment.status === "ACTIVE",
    ).length ?? 0;

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title={promptData.name}
        description={promptData.description || t("actual.noDescription")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("detail.currentVersion")}
          value={`r${promptData.draftRevision}`}
          description={t("actual.draftRevisionHint")}
        />
        <DashboardMetricCard
          label={t("actual.immutableVersions")}
          value={String(versions.data?.items.length ?? 0)}
          description={t("actual.immutableVersionsHint")}
        />
        <DashboardMetricCard
          label={t("actual.activeDeployments")}
          value={String(activeDeployments)}
          description={t("actual.activeDeploymentsHint")}
        />
        <DashboardMetricCard
          label={t("actual.activeExperiments")}
          value={String(activeExperiments)}
          description={t("actual.activeExperimentsHint")}
        />
      </DashboardMetricGrid>
      <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardPanel>
          <h2 className="text-sm font-semibold">{t("actual.draftContent")}</h2>
          <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
            {promptData.draftContent || t("actual.emptyDraft")}
          </pre>
        </DashboardPanel>
        <VersionList versions={versions.data?.items ?? []} />
      </section>
      <DeploymentAndExperimentLists
        deployments={deployments.data?.items ?? []}
        experiments={experiments.data?.items ?? []}
      />
    </div>
  );
}

function PromptList({ prompts }: { prompts: PromptItem[] }) {
  const t = useTranslations("prompts");

  return (
    <DashboardListPanel empty={prompts.length === 0} emptyText={t("empty")}>
      {prompts.slice(0, 8).map((prompt) => (
        <Link href={`/prompts/${prompt.id}`} key={prompt.id}>
          <DashboardListRow
            title={prompt.name}
            description={
              prompt.description?.trim() || t("actual.noDescription")
            }
            value={`r${prompt.draftRevision}`}
          />
        </Link>
      ))}
    </DashboardListPanel>
  );
}

function VersionList({ versions }: { versions: PromptVersion[] }) {
  const t = useTranslations("prompts");

  return (
    <DashboardPanel>
      <h2 className="text-sm font-semibold">{t("detail.versions")}</h2>
      <div className="mt-4 space-y-2">
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("actual.noVersions")}
          </p>
        ) : (
          versions.slice(0, 8).map((version) => (
            <div className="rounded-md border p-3" key={version.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{version.version}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(version.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {version.changeReason?.trim() || t("actual.noChangeReason")}
              </p>
            </div>
          ))
        )}
      </div>
    </DashboardPanel>
  );
}

function DeploymentAndExperimentLists({
  deployments,
  experiments,
}: {
  deployments: Awaited<ReturnType<typeof listPromptDeployments>>["items"];
  experiments: Awaited<ReturnType<typeof listPromptExperiments>>["items"];
}) {
  const t = useTranslations("prompts");

  return (
    <section className="grid gap-8 xl:grid-cols-2">
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          {t("actual.deployments")}
        </h2>
        <DashboardListPanel
          empty={deployments.length === 0}
          emptyText={t("deployments.empty")}
        >
          {deployments.slice(0, 8).map((deployment) => (
            <DashboardListRow
              key={deployment.id}
              title={`${deployment.environment} · ${deployment.version}`}
              description={deployment.agentId ?? t("actual.allAgents")}
              value={
                deployment.active ? t("actual.active") : t("actual.inactive")
              }
              tone={deployment.active ? "good" : "neutral"}
            />
          ))}
        </DashboardListPanel>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          {t("actual.experiments")}
        </h2>
        <DashboardListPanel
          empty={experiments.length === 0}
          emptyText={t("actual.noExperiments")}
        >
          {experiments.slice(0, 8).map((experiment) => (
            <DashboardListRow
              key={experiment.id}
              title={experiment.name}
              description={t("actual.experimentDescription", {
                environment: experiment.environment,
                variants: experiment.variants.length,
              })}
              value={experiment.status}
              tone={experiment.status === "ACTIVE" ? "good" : "neutral"}
            />
          ))}
        </DashboardListPanel>
      </div>
    </section>
  );
}

function PromptMessage({
  title,
  onRetry,
}: {
  title: string;
  onRetry?: () => unknown;
}) {
  const t = useTranslations("prompts");
  return (
    <ActualDataPageMessage
      pageTitle={title}
      pageDescription={t("actual.pageDescription")}
      title={t("actual.errorTitle")}
      description={t("actual.errorDescription")}
      action={onRetry ? t("actual.retry") : undefined}
      onRetry={onRetry ? () => void onRetry() : undefined}
    />
  );
}

function PromptEmptyMessage({
  pageTitle,
  pageDescription,
  title,
}: {
  pageTitle: string;
  pageDescription: string;
  title: string;
}) {
  const t = useTranslations("prompts");
  return (
    <ActualDataPageMessage
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      title={title}
      description={t("actual.compareUnavailableDescription")}
    />
  );
}
