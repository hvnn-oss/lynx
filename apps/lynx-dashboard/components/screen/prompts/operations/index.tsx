import {
  DashboardListPanel,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import {
  GitCompare,
  GitPullRequestArrow,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  getPrompt,
  listPromptChanges,
  listPromptDeployments,
  listPromptRegressions,
  listPrompts,
} from "@/lib/operations/service";
import type { Prompt, PromptVersion } from "@/lib/operations/types";
import { OperationsKpiCard } from "@/components/ui/operations/kpi-card";
import { OperationsSplitDiff } from "@/components/ui/operations/split-diff";
import {
  getSeverityClass,
  getStateClass,
  OperationsBadge,
} from "@/components/ui/operations/status-badge";
import { formatDateTime, formatDelta } from "@/components/ui/operations/format";

export function PromptsOverviewScreen() {
  const t = useTranslations("prompts");
  const prompts = listPrompts();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("overview.title")} description={t("overview.subtitle")} />
      <section className="grid gap-3 md:grid-cols-4">
        <OperationsKpiCard label={t("metrics.total")} value={String(prompts.length)} description={t("metrics.totalHint")} />
        <OperationsKpiCard label={t("metrics.production")} value={String(prompts.filter((prompt) => prompt.environment === "production").length)} description={t("metrics.productionHint")} tone="good" />
        <OperationsKpiCard label={t("metrics.openIssues")} value={String(prompts.reduce((sum, prompt) => sum + prompt.openIssues, 0))} description={t("metrics.openIssuesHint")} tone="warning" />
        <OperationsKpiCard label={t("metrics.avgSuccess")} value={`${Math.round(prompts.reduce((sum, prompt) => sum + prompt.successRateAfterLatest, 0) / prompts.length)}%`} description={t("metrics.avgSuccessHint")} />
      </section>
      <PromptList prompts={prompts} />
    </div>
  );
}

export function PromptChangesScreen() {
  const t = useTranslations("prompts.changes");
  const changes = listPromptChanges();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={changes.length === 0} emptyText={t("empty")}>
        {changes.map((change) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={change.id}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{change.promptName}</p>
                  <OperationsBadge className="border-slate-200 bg-slate-50 font-bold text-slate-700">
                    {change.fromVersion} -&gt; {change.toVersion}
                  </OperationsBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{change.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {change.changedBy} / {formatDateTime(change.changedAt)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right text-xs text-muted-foreground">
                <Metric label={t("successDelta")} value={`${formatDelta(change.successRateDelta)}%`} />
                <Metric label={t("issueDelta")} value={formatDelta(change.issueDelta)} />
                <Metric label={t("changedAt")} value={formatDateTime(change.changedAt)} />
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function PromptRegressionsScreen() {
  const t = useTranslations("prompts.regressions");
  const severity = useTranslations("severity");
  const regressions = listPromptRegressions();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={regressions.length === 0} emptyText={t("empty")}>
        {regressions.map((regression) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={regression.id}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{regression.promptName}</p>
                  <OperationsBadge className="border-slate-200 bg-slate-50 font-bold text-slate-700">
                    {regression.version}
                  </OperationsBadge>
                  <OperationsBadge className={getSeverityClass(regression.failureRateDelta > 6 ? "critical" : "warning")}>{severity(regression.failureRateDelta > 6 ? "critical" : "warning")}</OperationsBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{regression.suspectedCause}</p>
                <p className="mt-2 text-xs text-muted-foreground">{regression.linkedIssueIds.join(", ")}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right text-xs text-muted-foreground">
                <Metric label={t("failureDelta")} value={`${formatDelta(regression.failureRateDelta)}%`} />
                <Metric label={t("blockedDelta")} value={formatDelta(regression.blockedDelta)} />
                <Metric label={t("confidence")} value={`${regression.confidence}%`} />
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function PromptCompareScreen() {
  const t = useTranslations("prompts.compare");
  const prompt = listPrompts()[0];
  const latest = prompt.versions[0];
  const previous = prompt.versions[1] ?? latest;

  return (
    <div className="space-y-5">
      <DashboardPageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button variant="outline">
            <GitCompare data-icon="inline-start" />
            {t("runMock")}
          </Button>
        }
      />
      <PromptDiffWorkspace
        prompt={prompt}
        selectedVersion={latest}
        beforeLabel={previous.version}
        afterLabel={latest.version}
      />
    </div>
  );
}

export function PromptDeploymentsScreen() {
  const t = useTranslations("prompts.deployments");
  const deployments = listPromptDeployments();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={deployments.length === 0} emptyText={t("empty")}>
        {deployments.map((deployment) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={`${deployment.promptName}-${deployment.environment}`}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{deployment.promptName}</p>
                  <OperationsBadge className={getStateClass(deployment.status)}>{deployment.status}</OperationsBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {deployment.environment} / {deployment.version}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-right text-xs text-muted-foreground">
                <Metric label={t("deployedAt")} value={formatDateTime(deployment.deployedAt)} />
                <Metric label={t("rollbackTarget")} value={deployment.rollbackTarget ?? "-"} />
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function PromptDetailScreen({ promptId }: { promptId: string }) {
  const t = useTranslations("prompts.detail");
  const prompt = getPrompt(promptId);
  const latest = prompt.versions[0];
  const previous = prompt.versions[1] ?? latest;

  return (
    <div className="space-y-5">
      <DashboardPageHeader
        title={prompt.name}
        description={`${prompt.currentVersion} / ${prompt.environment}`}
        actions={
          <>
            <Button variant="outline">
              <RotateCcw data-icon="inline-start" />
              {t("rollback")}
            </Button>
            <Button>
              <UploadCloud data-icon="inline-start" />
              {t("update")}
            </Button>
          </>
        }
      />
      <section className="grid gap-3 md:grid-cols-4">
        <OperationsKpiCard label={t("currentVersion")} value={prompt.currentVersion} description={t("currentVersionHint")} />
        <OperationsKpiCard label={t("successRate")} value={`${prompt.successRateAfterLatest}%`} description={t("successRateHint")} tone={prompt.successRateAfterLatest < 93 ? "warning" : "good"} />
        <OperationsKpiCard label={t("openIssues")} value={String(prompt.openIssues)} description={t("openIssuesHint")} tone="warning" />
        <OperationsKpiCard label={t("linkedAgents")} value={String(prompt.linkedAgents.length)} description={prompt.linkedAgents.join(", ")} />
      </section>
      <PromptDiffWorkspace
        prompt={prompt}
        selectedVersion={latest}
        beforeLabel={previous.version}
        afterLabel={latest.version}
      />
    </div>
  );
}

function PromptList({ prompts }: { prompts: ReturnType<typeof listPrompts> }) {
  const t = useTranslations("prompts");

  return (
    <DashboardListPanel empty={prompts.length === 0} emptyText={t("empty")}>
      {prompts.map((prompt) => (
        <Link className="block rounded-md px-3 py-3 hover:bg-muted/30" href={`/prompts/${prompt.id}`} key={prompt.id}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{prompt.name}</p>
                <OperationsBadge className="border-slate-200 bg-slate-50 font-bold text-slate-700">{prompt.currentVersion}</OperationsBadge>
                <OperationsBadge className={getStateClass(prompt.environment)}>{prompt.environment}</OperationsBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{prompt.linkedAgents.join(", ")}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right text-xs text-muted-foreground">
              <Metric label={t("fields.lastUpdated")} value={formatDateTime(prompt.lastUpdatedAt)} />
              <Metric label={t("fields.successRate")} value={`${prompt.successRateAfterLatest}%`} />
              <Metric label={t("fields.openIssues")} value={String(prompt.openIssues)} />
            </div>
          </div>
        </Link>
      ))}
    </DashboardListPanel>
  );
}

function PromptDiffWorkspace({
  prompt,
  selectedVersion,
  beforeLabel,
  afterLabel,
}: {
  prompt: Prompt;
  selectedVersion: PromptVersion;
  beforeLabel: string;
  afterLabel: string;
}) {
  const t = useTranslations("prompts.detail");

  return (
    <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
      <DashboardPanel>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t("versions")}</h2>
          <OperationsBadge className={getStateClass(selectedVersion.deploymentStatus)}>
            {selectedVersion.deploymentStatus}
          </OperationsBadge>
        </div>
        <div className="mt-4 space-y-2">
          {prompt.versions.map((version) => (
            <VersionRow
              key={version.version}
              version={version}
              isSelected={version.version === selectedVersion.version}
            />
          ))}
        </div>
      </DashboardPanel>
      <DashboardPanel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 className="text-sm font-bold">{t("diff")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedVersion.author} / {formatDateTime(selectedVersion.changedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <GitCompare data-icon="inline-start" />
              {t("compare")}
            </Button>
            <Button variant="outline" size="sm">
              <GitPullRequestArrow data-icon="inline-start" />
              {t("review")}
            </Button>
          </div>
        </div>
        <div className="mb-4 rounded-md border border-border/70 bg-muted/20 p-3">
          <p className="text-sm font-bold">{selectedVersion.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("linkedIssues")}: {selectedVersion.linkedIssueIds.join(", ") || "-"} / {t("linkedSessions")}: {selectedVersion.linkedSessionIds.join(", ") || "-"}
          </p>
        </div>
        <OperationsSplitDiff
          before={selectedVersion.before}
          after={selectedVersion.after}
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
        />
      </DashboardPanel>
    </section>
  );
}

function VersionRow({
  version,
  isSelected,
}: {
  version: PromptVersion;
  isSelected: boolean;
}) {
  return (
    <div
      className={
        isSelected
          ? "rounded-md border border-blue-200 bg-blue-50 p-3"
          : "rounded-md border border-border/60 p-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{version.version}</p>
        <OperationsBadge className={getStateClass(version.deploymentStatus)}>
          {version.deploymentStatus}
        </OperationsBadge>
      </div>
      <p className="mt-2 text-xs font-medium text-muted-foreground">
        {version.author} / {formatDateTime(version.changedAt)}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{version.reason}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p>{label}</p>
      <p className="mt-1 font-bold text-foreground">{value}</p>
    </div>
  );
}
