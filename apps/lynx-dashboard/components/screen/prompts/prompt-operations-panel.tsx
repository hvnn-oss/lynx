"use client";

import {
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPanel,
  DashboardSectionHeader,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  Pause,
  Play,
  RefreshCcw,
  Rocket,
  RotateCcw,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatDateTime } from "@/components/ui/operations/format";
import {
  createPromptExperiment,
  deployPrompt,
  getPromptOperationsSummary,
  getPromptVersionPerformance,
  listPromptDeploymentOperations,
  listPromptExperimentOperations,
  listPromptTargetAgents,
  listPromptVersions,
  rollbackPrompt,
  updatePromptExperimentStatus,
} from "@/lib/prompts";

const ALL_AGENTS = "__all__";

type PromptVersion = Awaited<
  ReturnType<typeof listPromptVersions>
>["items"][number];

interface PromptPanelProps {
  workspaceId: string;
  promptId: string;
  versions: PromptVersion[];
}

/** 저장된 불변 버전의 배포·롤백과 SDK 갱신 안내를 제공합니다. */
export function PromptDeploymentPanel({
  workspaceId,
  promptId,
  versions,
}: PromptPanelProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const deployments = useQuery({
    queryKey: ["prompt-operations", workspaceId, promptId, "deployments"],
    queryFn: () =>
      listPromptDeploymentOperations(workspaceId, {
        promptId,
        limit: 100,
      }),
  });
  const agents = useQuery({
    queryKey: ["prompt-operations", workspaceId, "target-agents"],
    queryFn: () => listPromptTargetAgents(workspaceId),
  });
  const summary = useQuery({
    queryKey: ["prompt-operations", workspaceId, "summary"],
    queryFn: () => getPromptOperationsSummary(workspaceId),
  });

  const refreshOperations = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["prompt-operations", workspaceId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["prompts", workspaceId],
    });
  };

  const hasError = deployments.isError || agents.isError || summary.isError;

  return (
    <div className="space-y-6">
      <OperationFeedback
        notice={notice}
        hasError={hasError}
        onRetry={refreshOperations}
      />
      <DeploymentSection
        workspaceId={workspaceId}
        promptId={promptId}
        versions={versions}
        deployments={deployments.data?.items ?? []}
        agents={agents.data?.items ?? []}
        onChanged={async (message) => {
          setNotice(message);
          await refreshOperations();
        }}
      />
      <SdkRefreshSection summary={summary.data} />
    </div>
  );
}

/** 불변 버전별 성공률·오류율·비용과 변경 영향 이슈를 제공합니다. */
export function PromptPerformancePanel({
  workspaceId,
  promptId,
}: Omit<PromptPanelProps, "versions">) {
  const performance = useQuery({
    queryKey: ["prompt-operations", workspaceId, promptId, "performance"],
    queryFn: () => getPromptVersionPerformance(workspaceId, promptId),
  });
  return (
    <div className="space-y-6">
      <OperationFeedback
        hasError={performance.isError}
        onRetry={() => performance.refetch().then(() => undefined)}
      />
      <PerformanceSection items={performance.data?.items ?? []} />
    </div>
  );
}

/** A/B 실험 생성과 상태·트래픽 결과 관리를 제공합니다. */
export function PromptExperimentPanel({
  workspaceId,
  promptId,
  versions,
}: PromptPanelProps) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const experiments = useQuery({
    queryKey: ["prompt-operations", workspaceId, promptId, "experiments"],
    queryFn: () =>
      listPromptExperimentOperations(workspaceId, {
        promptId,
        limit: 100,
      }),
  });
  const agents = useQuery({
    queryKey: ["prompt-operations", workspaceId, "target-agents"],
    queryFn: () => listPromptTargetAgents(workspaceId),
  });
  const refreshExperiments = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["prompt-operations", workspaceId, promptId, "experiments"],
    });
  };
  return (
    <div className="space-y-6">
      <OperationFeedback
        notice={notice}
        hasError={experiments.isError || agents.isError}
        onRetry={refreshExperiments}
      />
      <ExperimentSection
        workspaceId={workspaceId}
        promptId={promptId}
        versions={versions}
        experiments={experiments.data?.items ?? []}
        agents={agents.data?.items ?? []}
        onChanged={async (message) => {
          setNotice(message);
          await refreshExperiments();
        }}
      />
    </div>
  );
}

function OperationFeedback({
  notice,
  hasError,
  onRetry,
}: {
  notice?: string | null;
  hasError: boolean;
  onRetry: () => Promise<void>;
}) {
  const t = useTranslations("promptManagement");
  return (
    <>
      {notice ? (
        <div className="rounded-lg border bg-background px-3 py-2 text-sm">
          {notice}
        </div>
      ) : null}
      {hasError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span>{t("operations.loadFailed")}</span>
          <Button size="sm" variant="outline" onClick={() => void onRetry()}>
            <RefreshCcw />
            {t("common.retry")}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function DeploymentSection({
  workspaceId,
  promptId,
  versions,
  deployments,
  agents,
  onChanged,
}: {
  workspaceId: string;
  promptId: string;
  versions: PromptVersion[];
  deployments: Awaited<
    ReturnType<typeof listPromptDeploymentOperations>
  >["items"];
  agents: Awaited<ReturnType<typeof listPromptTargetAgents>>["items"];
  onChanged: (message: string) => Promise<void>;
}) {
  const t = useTranslations("promptManagement");
  const [versionId, setVersionId] = useState(versions[0]?.id ?? "");
  const [environment, setEnvironment] = useState<"staging" | "production">(
    "staging",
  );
  const [agentId, setAgentId] = useState(ALL_AGENTS);
  const [reason, setReason] = useState("");
  const activeDeployments = deployments.filter(
    (deployment) => deployment.active,
  );

  const deployMutation = useMutation({
    mutationFn: () => {
      const targetAgentId = agentId === ALL_AGENTS ? null : agentId;
      const current = activeDeployments.find(
        (deployment) =>
          deployment.environment === environment &&
          deployment.agentId === targetAgentId,
      );
      return deployPrompt(workspaceId, promptId, {
        versionId,
        environment,
        agentId: targetAgentId,
        reason: reason.trim() || null,
        expectedDeploymentId: current?.id ?? null,
      });
    },
    onSuccess: async () => {
      setReason("");
      await onChanged(t("deployment.deployed"));
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (
      deployment: Awaited<
        ReturnType<typeof listPromptDeploymentOperations>
      >["items"][number],
    ) => {
      const current = activeDeployments.find(
        (candidate) =>
          candidate.environment === deployment.environment &&
          candidate.agentId === deployment.agentId,
      );
      return rollbackPrompt(workspaceId, promptId, {
        versionId: deployment.versionId,
        environment: deployment.environment,
        agentId: deployment.agentId,
        reason: t("deployment.rollbackReason", {
          version: deployment.version,
        }),
        expectedDeploymentId: current?.id ?? null,
      });
    },
    onSuccess: async () => {
      await onChanged(t("deployment.rolledBack"));
    },
  });

  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("deployment.title")}
        description={t("deployment.description")}
      />
      <DashboardMetricGrid className="xl:grid-cols-2">
        {(["staging", "production"] as const).map((targetEnvironment) => {
          const active = activeDeployments.filter(
            (deployment) => deployment.environment === targetEnvironment,
          );
          return (
            <DashboardMetricCard
              key={targetEnvironment}
              label={t(`deployment.environment.${targetEnvironment}`)}
              value={
                active.length > 0
                  ? t("deployment.activeCount", { count: active.length })
                  : t("deployment.notDeployed")
              }
              description={
                active.length > 0
                  ? active
                      .slice(0, 3)
                      .map(
                        (deployment) =>
                          `${deployment.version} · ${deployment.agentName ?? t("deployment.allAgents")}`,
                      )
                      .join(", ")
                  : t("deployment.notDeployedHint")
              }
              tone={active.length > 0 ? "good" : "neutral"}
            />
          );
        })}
      </DashboardMetricGrid>

      <DashboardPanel>
        <FieldGroup>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel>{t("deployment.version")}</FieldLabel>
              <VersionSelect
                versions={versions}
                value={versionId}
                onValueChange={setVersionId}
              />
            </Field>
            <Field>
              <FieldLabel>{t("deployment.targetEnvironment")}</FieldLabel>
              <Select
                value={environment}
                onValueChange={(value) =>
                  setEnvironment(value as "staging" | "production")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">
                    {t("deployment.environment.staging")}
                  </SelectItem>
                  <SelectItem value="production">
                    {t("deployment.environment.production")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("deployment.targetAgent")}</FieldLabel>
              <AgentSelect
                agents={agents}
                value={agentId}
                onValueChange={setAgentId}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="prompt-deployment-reason">
              {t("deployment.reason")}
            </FieldLabel>
            <Textarea
              id="prompt-deployment-reason"
              className="min-h-20"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <FieldDescription>{t("deployment.replaceHint")}</FieldDescription>
          </Field>
          {deployMutation.isError ? (
            <FieldError>{t("deployment.failed")}</FieldError>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={!versionId || deployMutation.isPending}
              onClick={() => deployMutation.mutate()}
            >
              <Rocket />
              {deployMutation.isPending
                ? t("deployment.deploying")
                : t("deployment.deploy")}
            </Button>
          </div>
        </FieldGroup>
      </DashboardPanel>

      <DashboardPanel>
        <div className="divide-y divide-border/50">
          {deployments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("deployment.empty")}
            </p>
          ) : (
            deployments.slice(0, 30).map((deployment) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={deployment.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{deployment.version}</p>
                    <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {t(`deployment.environment.${deployment.environment}`)}
                    </span>
                    <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {deployment.agentName ?? t("deployment.allAgents")}
                    </span>
                    {deployment.active ? (
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
                        {t("deployment.active")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(deployment.deployedAt)}
                    {deployment.reason ? ` · ${deployment.reason}` : ""}
                  </p>
                </div>
                {!deployment.active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rollbackMutation.isPending}
                    onClick={() => rollbackMutation.mutate(deployment)}
                  >
                    <RotateCcw />
                    {t("deployment.rollback")}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </DashboardPanel>
    </section>
  );
}

function SdkRefreshSection({
  summary,
}: {
  summary: Awaited<ReturnType<typeof getPromptOperationsSummary>> | undefined;
}) {
  const t = useTranslations("promptManagement");
  if (!summary) return null;
  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("sdkRefresh.title")}
        description={t("sdkRefresh.description")}
      />
      <DashboardPanel>
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("sdkRefresh.lastChanged")}
            </p>
            <p className="mt-1 text-sm font-medium">
              {summary.lastConfigurationChangedAt
                ? formatDateTime(summary.lastConfigurationChangedAt)
                : t("sdkRefresh.noChanges")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("sdkRefresh.defaultInterval")}
            </p>
            <p className="mt-1 text-sm font-medium">
              {t("sdkRefresh.seconds", {
                count: summary.sdkConfig.defaultRefreshIntervalMs / 1_000,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("sdkRefresh.delivery")}
            </p>
            <p className="mt-1 text-sm font-medium">{t("sdkRefresh.pull")}</p>
          </div>
        </div>
        <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
          {t("sdkRefresh.acknowledgementNotice")}
        </p>
      </DashboardPanel>
    </section>
  );
}

function PerformanceSection({
  items,
}: {
  items: Awaited<ReturnType<typeof getPromptVersionPerformance>>["items"];
}) {
  const t = useTranslations("promptManagement");
  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("performance.title")}
        description={t("performance.description")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/issues/change-impact">
              {t("performance.openIssues")}
            </Link>
          </Button>
        }
      />
      <DashboardPanel>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("performance.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px] divide-y divide-border/50">
              <div className="grid grid-cols-[1.2fr_repeat(5,1fr)] gap-3 pb-2 text-xs text-muted-foreground">
                <span>{t("performance.version")}</span>
                <span>{t("performance.runs")}</span>
                <span>{t("performance.success")}</span>
                <span>{t("performance.errors")}</span>
                <span>{t("performance.cost")}</span>
                <span>{t("performance.issues")}</span>
              </div>
              {items.map((item) => (
                <div
                  className="grid grid-cols-[1.2fr_repeat(5,1fr)] gap-3 py-3 text-sm"
                  key={item.versionId}
                >
                  <span className="font-medium">{item.version}</span>
                  <span>{item.metrics.runCount.toLocaleString()}</span>
                  <span>{formatRate(item.metrics.successRate)}</span>
                  <span>{formatRate(item.metrics.errorRate)}</span>
                  <span>{formatCost(item.metrics.totalCost)}</span>
                  <span>{item.changeImpactIssueCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardPanel>
    </section>
  );
}

function ExperimentSection({
  workspaceId,
  promptId,
  versions,
  experiments,
  agents,
  onChanged,
}: {
  workspaceId: string;
  promptId: string;
  versions: PromptVersion[];
  experiments: Awaited<
    ReturnType<typeof listPromptExperimentOperations>
  >["items"];
  agents: Awaited<ReturnType<typeof listPromptTargetAgents>>["items"];
  onChanged: (message: string) => Promise<void>;
}) {
  const t = useTranslations("promptManagement");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"staging" | "production">(
    "staging",
  );
  const [agentId, setAgentId] = useState(ALL_AGENTS);
  const [firstVersionId, setFirstVersionId] = useState(versions[0]?.id ?? "");
  const [secondVersionId, setSecondVersionId] = useState(versions[1]?.id ?? "");
  const [firstWeight, setFirstWeight] = useState(50);
  const [activation, setActivation] = useState<"DRAFT" | "ACTIVE">("DRAFT");

  const createMutation = useMutation({
    mutationFn: () =>
      createPromptExperiment(workspaceId, promptId, {
        name,
        environment,
        agentId: agentId === ALL_AGENTS ? null : agentId,
        variants: [
          { versionId: firstVersionId, weight: firstWeight },
          { versionId: secondVersionId, weight: 100 - firstWeight },
        ],
        activate: activation === "ACTIVE",
      }),
    onSuccess: async () => {
      setName("");
      await onChanged(t("experiment.created"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      experimentId,
      status,
    }: {
      experimentId: string;
      status: "ACTIVE" | "PAUSED" | "COMPLETED";
    }) =>
      updatePromptExperimentStatus(workspaceId, promptId, experimentId, {
        status,
      }),
    onSuccess: async () => {
      await onChanged(t("experiment.statusChanged"));
    },
  });

  const canCreate =
    name.trim().length > 0 &&
    firstVersionId.length > 0 &&
    secondVersionId.length > 0 &&
    firstVersionId !== secondVersionId &&
    firstWeight >= 1 &&
    firstWeight <= 99;

  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("experiment.title")}
        description={t("experiment.description")}
      />
      <DashboardPanel>
        <FieldGroup>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="experiment-name">
                {t("experiment.name")}
              </FieldLabel>
              <Input
                id="experiment-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("experiment.environment")}</FieldLabel>
              <Select
                value={environment}
                onValueChange={(value) =>
                  setEnvironment(value as "staging" | "production")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">
                    {t("deployment.environment.staging")}
                  </SelectItem>
                  <SelectItem value="production">
                    {t("deployment.environment.production")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t("experiment.agent")}</FieldLabel>
              <AgentSelect
                agents={agents}
                value={agentId}
                onValueChange={setAgentId}
              />
            </Field>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_8rem_1fr_8rem]">
            <Field>
              <FieldLabel>{t("experiment.firstVersion")}</FieldLabel>
              <VersionSelect
                versions={versions}
                value={firstVersionId}
                onValueChange={setFirstVersionId}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="experiment-first-weight">
                {t("experiment.weight")}
              </FieldLabel>
              <Input
                id="experiment-first-weight"
                type="number"
                min={1}
                max={99}
                value={firstWeight}
                onChange={(event) => setFirstWeight(Number(event.target.value))}
              />
            </Field>
            <Field>
              <FieldLabel>{t("experiment.secondVersion")}</FieldLabel>
              <VersionSelect
                versions={versions}
                value={secondVersionId}
                onValueChange={setSecondVersionId}
              />
            </Field>
            <Field>
              <FieldLabel>{t("experiment.weight")}</FieldLabel>
              <Input value={100 - firstWeight} disabled />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <Field>
              <FieldLabel>{t("experiment.initialStatus")}</FieldLabel>
              <Select
                value={activation}
                onValueChange={(value) =>
                  setActivation(value as "DRAFT" | "ACTIVE")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">
                    {t("experiments.status.DRAFT")}
                  </SelectItem>
                  <SelectItem value="ACTIVE">
                    {t("experiments.status.ACTIVE")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                {t("experiment.activationHint")}
              </FieldDescription>
            </Field>
            <Button
              disabled={!canCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <FlaskConical />
              {createMutation.isPending
                ? t("experiment.creating")
                : t("experiment.create")}
            </Button>
          </div>
          {versions.length < 2 ? (
            <FieldError>{t("experiment.needVersions")}</FieldError>
          ) : firstVersionId === secondVersionId ? (
            <FieldError>{t("experiment.differentVersions")}</FieldError>
          ) : createMutation.isError ? (
            <FieldError>{t("experiment.createFailed")}</FieldError>
          ) : null}
        </FieldGroup>
      </DashboardPanel>

      <DashboardPanel>
        {experiments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("experiments.empty")}
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {experiments.map((experiment) => (
              <div className="space-y-3 py-4" key={experiment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{experiment.name}</p>
                      <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {t(`experiments.status.${experiment.status}`)}
                      </span>
                      <span className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {t(`deployment.environment.${experiment.environment}`)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {experiment.agentName ?? t("deployment.allAgents")} ·{" "}
                      {formatDateTime(experiment.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {experiment.status !== "ACTIVE" &&
                    experiment.status !== "COMPLETED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMutation.mutate({
                            experimentId: experiment.id,
                            status: "ACTIVE",
                          })
                        }
                      >
                        <Play />
                        {t("experiment.start")}
                      </Button>
                    ) : null}
                    {experiment.status === "ACTIVE" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMutation.mutate({
                            experimentId: experiment.id,
                            status: "PAUSED",
                          })
                        }
                      >
                        <Pause />
                        {t("experiment.pause")}
                      </Button>
                    ) : null}
                    {experiment.status !== "COMPLETED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          statusMutation.mutate({
                            experimentId: experiment.id,
                            status: "COMPLETED",
                          })
                        }
                      >
                        <Square />
                        {t("experiment.complete")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {experiment.variants.map((variant) => (
                    <div
                      className="rounded-lg border bg-muted/20 px-3 py-2"
                      key={variant.versionId}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{variant.version}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("experiment.allocation", {
                            target: `${variant.weight}%`,
                            actual: formatRate(variant.metrics.actualWeight),
                          })}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("experiment.volume", {
                          assigned: variant.metrics.runCount,
                          resolved: variant.metrics.resolvedRunCount,
                          pending: variant.metrics.pendingRunCount,
                        })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("experiment.performance", {
                          success: formatRate(variant.metrics.successRate),
                          errors: formatRate(variant.metrics.errorRate),
                          cost: formatCost(variant.metrics.averageCost),
                          latency: formatLatency(
                            variant.metrics.averageLatencyMs,
                          ),
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </section>
  );
}

function VersionSelect({
  versions,
  value,
  onValueChange,
}: {
  versions: PromptVersion[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((version) => (
          <SelectItem key={version.id} value={version.id}>
            {version.version}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AgentSelect({
  agents,
  value,
  onValueChange,
}: {
  agents: Awaited<ReturnType<typeof listPromptTargetAgents>>["items"];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const t = useTranslations("promptManagement");
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_AGENTS}>{t("deployment.allAgents")}</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

function formatLatency(value: number) {
  return `${Math.round(value).toLocaleString()}ms`;
}
