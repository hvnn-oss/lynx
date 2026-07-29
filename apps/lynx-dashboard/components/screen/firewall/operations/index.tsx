"use client";

import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
  DashboardSectionHeader,
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
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Plus, ShieldAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import {
  decideFirewallApproval,
  listFirewallApprovals,
  listFirewallPolicies,
  listFirewallRecords,
  simulateFirewallPolicy,
} from "@/lib/firewall";

function useFirewallPageData(
  requested: {
    policies?: boolean;
    approvals?: boolean;
    records?: boolean;
  } = { policies: true, approvals: true, records: true },
) {
  const workspace = useCurrentWorkspace();
  const needsPolicies = requested.policies ?? false;
  const needsApprovals = requested.approvals ?? false;
  const needsRecords = requested.records ?? false;
  const policies = useQuery({
    queryKey: ["firewall", "policies", workspace.workspaceId],
    queryFn: () => listFirewallPolicies(workspace.workspaceId),
    enabled: workspace.hasWorkspace && needsPolicies,
  });
  const approvals = useQuery({
    queryKey: ["firewall", "approvals", workspace.workspaceId],
    queryFn: () => listFirewallApprovals(workspace.workspaceId),
    enabled: workspace.hasWorkspace && needsApprovals,
  });
  const records = useQuery({
    queryKey: ["firewall", "records", workspace.workspaceId],
    queryFn: () => listFirewallRecords(workspace.workspaceId, { limit: 25 }),
    enabled: workspace.hasWorkspace && needsRecords,
  });

  return {
    workspace,
    policies: policies.data?.items ?? [],
    approvals: approvals.data?.items ?? [],
    records: records.data?.items ?? [],
    isPending:
      workspace.isPending ||
      (workspace.hasWorkspace &&
        ((needsPolicies && policies.isPending) ||
          (needsApprovals && approvals.isPending) ||
          (needsRecords && records.isPending))),
    isError:
      workspace.isError ||
      (needsPolicies && policies.isError) ||
      (needsApprovals && approvals.isError) ||
      (needsRecords && records.isError),
    refetch: () =>
      Promise.all([
        ...(needsPolicies ? [policies.refetch()] : []),
        ...(needsApprovals ? [approvals.refetch()] : []),
        ...(needsRecords ? [records.refetch()] : []),
      ]),
  };
}

/** 방화벽의 핵심 운영 신호와 최근 판단을 요약합니다. */
export function FirewallOverviewScreen() {
  const t = useTranslations("firewall");
  const data = useFirewallPageData();
  if (data.isPending) return <ActualDataPageLoading />;
  if (data.isError) {
    return (
      <FirewallMessage title={t("overview.title")} onRetry={data.refetch} />
    );
  }

  const active = data.policies.filter((policy) => policy.activated).length;
  const pending = data.approvals.filter(
    (approval) => approval.status === "PENDING",
  ).length;
  const blocked = data.records.filter(
    (record) => record.action === "BLOCK",
  ).length;
  const approvals = data.records.filter(
    (record) => record.action === "REQUIRE_APPROVAL",
  ).length;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("overview.title")}
        description={t("overview.subtitle")}
        actions={
          <Button asChild>
            <Link href="/firewall/policies/new">
              <Plus />
              {t("policies.new")}
            </Link>
          </Button>
        }
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("metrics.activePolicies")}
          value={String(active)}
          description={t("metrics.activePoliciesHint")}
          tone="good"
        />
        <DashboardMetricCard
          label={t("metrics.pendingApprovals")}
          value={String(pending)}
          description={t("metrics.pendingApprovalsHint")}
          tone={pending > 0 ? "warning" : "neutral"}
        />
        <DashboardMetricCard
          label={t("metrics.recentBlocks")}
          value={String(blocked)}
          description={t("metrics.recentRecordsHint")}
          tone={blocked > 0 ? "bad" : "neutral"}
        />
        <DashboardMetricCard
          label={t("metrics.approvalDecisions")}
          value={String(approvals)}
          description={t("metrics.recentRecordsHint")}
        />
        <DashboardMetricCard
          label={t("metrics.deployRequired")}
          value={String(
            data.policies.filter((policy) => policy.isDirty).length,
          )}
          description={t("metrics.deployRequiredHint")}
          tone="warning"
        />
      </DashboardMetricGrid>

      <section className="space-y-3">
        <DashboardSectionHeader
          title={t("overview.recentTitle")}
          description={t("overview.recentDescription")}
          action={
            <Button asChild size="sm" variant="ghost">
              <Link href="/firewall/records">{t("common.viewAll")}</Link>
            </Button>
          }
        />
        <DashboardListPanel
          empty={data.records.length === 0}
          emptyText={t("records.empty")}
        >
          {data.records.slice(0, 6).map((record) => (
            <DashboardListRow
              key={record.id}
              title={
                record.toolName ??
                record.policy?.name ??
                t("records.unknownDecision")
              }
              description={t("records.rowDescription", {
                policy:
                  record.policy?.name ??
                  record.reportedPolicyId ??
                  t("common.unknown"),
                agent: record.agent?.name ?? t("common.unknown"),
              })}
              value={record.action}
              tone={record.action === "BLOCK" ? "bad" : "warning"}
            />
          ))}
        </DashboardListPanel>
      </section>
    </div>
  );
}

/** 정책 목록에 초안·배포·적용 범위와 최근 일치 상태를 표시합니다. */
export function FirewallPoliciesScreen() {
  const t = useTranslations("firewall");
  const data = useFirewallPageData({ policies: true });
  if (data.isPending) return <ActualDataPageLoading />;
  if (data.isError) {
    return (
      <FirewallMessage title={t("policies.title")} onRetry={data.refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("policies.title")}
        description={t("policies.subtitle")}
        actions={
          <Button asChild>
            <Link href="/firewall/policies/new">
              <Plus />
              {t("policies.new")}
            </Link>
          </Button>
        }
      />
      <DashboardPanel className="overflow-x-auto p-0">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[minmax(220px,1.7fr)_140px_150px_minmax(180px,1fr)_130px_100px] gap-3 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
            <span>{t("policies.columns.policy")}</span>
            <span>{t("policies.columns.runtime")}</span>
            <span>{t("policies.columns.deployment")}</span>
            <span>{t("policies.columns.scope")}</span>
            <span>{t("policies.columns.lastMatched")}</span>
            <span className="text-right">{t("policies.columns.blocks")}</span>
          </div>
          {data.policies.map((policy) => (
            <Link
              className="grid grid-cols-[minmax(220px,1.7fr)_140px_150px_minmax(180px,1fr)_130px_100px] items-center gap-3 border-b px-4 py-4 text-sm transition-colors last:border-0 hover:bg-muted/30"
              href={`/firewall/policies/${policy.id}`}
              key={policy.id}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{policy.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {policy.version} · {policy.action} · {policy.severity}
                </p>
              </div>
              <StatusBadge
                label={
                  policy.activated ? t("status.active") : t("status.inactive")
                }
                tone={policy.activated ? "good" : "neutral"}
              />
              <StatusBadge
                label={
                  policy.deployedRevision === null
                    ? t("status.draft")
                    : policy.isDirty
                      ? t("status.deployRequired")
                      : t("status.deployed")
                }
                tone={
                  policy.deployedRevision === null
                    ? "neutral"
                    : policy.isDirty
                      ? "warning"
                      : "good"
                }
              />
              <p className="truncate text-xs text-muted-foreground">
                {formatScope(policy.environments, policy.agentIds.length, t)}
              </p>
              <p className="text-xs text-muted-foreground">
                {policy.lastMatchedAt
                  ? new Date(policy.lastMatchedAt).toLocaleString()
                  : t("common.never")}
              </p>
              <p className="text-right font-semibold tabular-nums">
                {policy.recentBlockCount}
              </p>
            </Link>
          ))}
          {data.policies.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("policies.empty")}
            </p>
          ) : null}
        </div>
      </DashboardPanel>
    </div>
  );
}

/** 대기 중인 도구 실행 요청을 실제 승인 또는 거절할 수 있게 표시합니다. */
export function FirewallApprovalsScreen() {
  const t = useTranslations("firewall");
  const data = useFirewallPageData({ approvals: true });
  const queryClient = useQueryClient();
  const decision = useMutation({
    mutationFn: async ({
      approvalId,
      decision,
      reason,
    }: {
      approvalId: string;
      decision: "APPROVED" | "REJECTED";
      reason?: string;
    }) =>
      decideFirewallApproval(data.workspace.workspaceId, approvalId, {
        decision,
        reason,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["firewall", "approvals"],
      });
    },
  });

  if (data.isPending) return <ActualDataPageLoading />;
  if (data.isError) {
    return (
      <FirewallMessage title={t("approvals.title")} onRetry={data.refetch} />
    );
  }

  function reject(approvalId: string) {
    const reason = window.prompt(t("approvals.rejectReason"));
    if (reason === null) return;
    decision.mutate({ approvalId, decision: "REJECTED", reason });
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("approvals.title")}
        description={t("approvals.subtitle")}
      />
      <DashboardPanel className="p-0">
        <div className="divide-y">
          {data.approvals.map((approval) => (
            <div
              className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center"
              key={approval.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{approval.toolName}</p>
                  <StatusBadge
                    label={approval.status}
                    tone={
                      approval.status === "PENDING"
                        ? "warning"
                        : approval.status === "APPROVED"
                          ? "good"
                          : "neutral"
                    }
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {approval.requestReason ?? t("approvals.noReason")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("approvals.context", {
                    agent: approval.agentId,
                    run: approval.runId,
                  })}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                <p>
                  {t("approvals.requestedAt")}:{" "}
                  {new Date(approval.requestedAt).toLocaleString()}
                </p>
                <p className="mt-1">
                  {t("approvals.expiresAt")}:{" "}
                  {new Date(approval.expiresAt).toLocaleString()}
                </p>
              </div>
              {approval.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      decision.mutate({
                        approvalId: approval.id,
                        decision: "APPROVED",
                      })
                    }
                    disabled={decision.isPending}
                  >
                    <Check />
                    {t("approvals.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => reject(approval.id)}
                    disabled={decision.isPending}
                  >
                    <X />
                    {t("approvals.reject")}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {approval.decisionReason ?? t("approvals.noDecisionReason")}
                </p>
              )}
            </div>
          ))}
          {data.approvals.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("approvals.empty")}
            </p>
          ) : null}
        </div>
      </DashboardPanel>
    </div>
  );
}

/** 정책 판단, Tool, Agent, Run 관계를 함께 보여주는 운영 기록 화면입니다. */
export function FirewallRecordsScreen() {
  const t = useTranslations("firewall");
  const data = useFirewallPageData({ records: true });
  if (data.isPending) return <ActualDataPageLoading />;
  if (data.isError) {
    return (
      <FirewallMessage title={t("records.title")} onRetry={data.refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("records.title")}
        description={t("records.subtitle")}
      />
      <DashboardPanel className="p-0">
        <div className="divide-y">
          {data.records.map((record) => (
            <div
              className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px]"
              key={record.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className="size-4 text-muted-foreground" />
                  <p className="font-medium">
                    {record.toolName ?? t("records.unknownTool")}
                  </p>
                  <StatusBadge
                    label={record.action}
                    tone={record.action === "BLOCK" ? "bad" : "warning"}
                  />
                  {record.severity ? (
                    <span className="text-xs text-muted-foreground">
                      {record.severity}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {record.message ?? t("records.noMessage")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(record.createdAt).toLocaleString()}
                </p>
              </div>
              <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{t("records.policy")}</dt>
                <dd className="truncate">
                  {record.policy?.name ??
                    record.reportedPolicyId ??
                    t("common.unknown")}
                </dd>
                <dt className="text-muted-foreground">{t("records.agent")}</dt>
                <dd className="truncate">
                  {record.agent?.name ?? t("common.unknown")}
                </dd>
                <dt className="text-muted-foreground">
                  {t("records.environment")}
                </dt>
                <dd>{record.environment ?? t("common.unknown")}</dd>
              </dl>
              <div className="flex flex-col items-start gap-1">
                {record.sessionId ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      href={`/dashboard/session/detail/${record.sessionId}`}
                    >
                      {t("records.openSession")}
                      <ExternalLink />
                    </Link>
                  </Button>
                ) : null}
                {record.agent ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/agents/${record.agent.id}`}>
                      {t("records.openAgent")}
                      <ExternalLink />
                    </Link>
                  </Button>
                ) : null}
                {record.runId ? (
                  <span className="px-2 text-xs text-muted-foreground">
                    Run {record.runId.slice(0, 8)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
          {data.records.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("records.empty")}
            </p>
          ) : null}
        </div>
      </DashboardPanel>
    </div>
  );
}

/** 저장된 정책을 선택해 다양한 Tool 입력과 실행 상태로 시험합니다. */
export function FirewallLabScreen() {
  const t = useTranslations("firewall");
  const data = useFirewallPageData({ policies: true });
  const [policyId, setPolicyId] = useState("");
  const [toolName, setToolName] = useState("transfer");
  const [riskLevel, setRiskLevel] = useState("CRITICAL");
  const [sideEffect, setSideEffect] = useState(true);
  const [inputJson, setInputJson] = useState('{\n  "amount": 1500\n}');
  const [outputText, setOutputText] = useState("");
  const [state, setState] = useState({
    callCount: 1,
    totalCost: 0,
    elapsedMs: 0,
    loopCount: 0,
  });
  const simulation = useMutation({
    mutationFn: async () => {
      let input: unknown;
      try {
        input = JSON.parse(inputJson);
      } catch {
        throw new Error("INVALID_JSON");
      }
      return simulateFirewallPolicy(
        data.workspace.workspaceId,
        Number(policyId || data.policies[0]?.id),
        {
          tool: {
            name: toolName,
            riskLevel: riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            sideEffect,
          },
          input,
          output: outputText,
          state,
        },
      );
    },
  });

  if (data.isPending) return <ActualDataPageLoading />;
  if (data.isError) {
    return <FirewallMessage title={t("lab.title")} onRetry={data.refetch} />;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={t("lab.title")}
        description={t("lab.subtitle")}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardPanel>
          <div className="space-y-4">
            <Field label={t("lab.policy")}>
              <Select
                value={policyId || data.policies[0]?.id || ""}
                onValueChange={setPolicyId}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={t("lab.policy")} />
                </SelectTrigger>
                <SelectContent>
                  {data.policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.name} · r{policy.draftRevision}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("test.toolName")}>
                <Input
                  value={toolName}
                  onChange={(event) => setToolName(event.target.value)}
                />
              </Field>
              <Field label={t("test.riskLevel")}>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((risk) => (
                      <SelectItem key={risk} value={risk}>
                        {risk}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sideEffect}
                onChange={(event) => setSideEffect(event.target.checked)}
              />
              {t("test.sideEffect")}
            </label>
            <Field label={t("test.inputJson")}>
              <Textarea
                className="min-h-40 font-mono text-xs"
                value={inputJson}
                onChange={(event) => setInputJson(event.target.value)}
              />
            </Field>
            <Field label={t("test.outputText")}>
              <Textarea
                className="min-h-24 text-sm"
                value={outputText}
                onChange={(event) => setOutputText(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(state) as (keyof typeof state)[]).map((key) => (
                <Field label={t(`test.${key}`)} key={key}>
                  <Input
                    type="number"
                    min={0}
                    value={state[key]}
                    onChange={(event) =>
                      setState({ ...state, [key]: Number(event.target.value) })
                    }
                  />
                </Field>
              ))}
            </div>
            <Button
              disabled={data.policies.length === 0 || simulation.isPending}
              onClick={() => simulation.mutate()}
            >
              {simulation.isPending ? t("test.running") : t("test.run")}
            </Button>
            {simulation.isError ? (
              <p className="text-sm text-rose-700">{t("lab.invalidInput")}</p>
            ) : null}
          </div>
        </DashboardPanel>
        <DashboardPanel>
          <DashboardSectionHeader
            title={t("test.resultTitle")}
            description={
              simulation.data
                ? t("lab.resultDescription", {
                    action: simulation.data.action,
                    revision: simulation.data.revision,
                  })
                : t("lab.resultEmpty")
            }
          />
          {simulation.data ? (
            <div className="mt-4 space-y-2">
              {simulation.data.conditions.map((condition, index) => (
                <div
                  className="flex gap-3 rounded-md border px-3 py-3"
                  key={`${condition.expression}-${index}`}
                >
                  {condition.matched ? (
                    <Check className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <X className="size-4 shrink-0 text-rose-600" />
                  )}
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs">
                      {condition.expression}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("test.actualValue", {
                        value: formatValue(condition.actual),
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
              {t("lab.resultEmpty")}
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}

/** 이전 경로에서 사용하던 이름을 새 운영 화면에 호환시킵니다. */
export const BlockedEventsScreen = FirewallRecordsScreen;
export const PolicyCoverageScreen = FirewallPoliciesScreen;
export const RiskToolsScreen = FirewallApprovalsScreen;
export const PolicySimulationScreen = FirewallLabScreen;

function FirewallMessage({
  title,
  onRetry,
}: {
  title: string;
  onRetry?: () => unknown;
}) {
  const t = useTranslations("firewall");
  return (
    <ActualDataPageMessage
      pageTitle={title}
      pageDescription={t("common.pageDescription")}
      title={t("common.errorTitle")}
      description={t("common.errorDescription")}
      action={onRetry ? t("common.retry") : undefined}
      onRetry={onRetry ? () => void onRetry() : undefined}
    />
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "warning" | "bad" | "neutral";
}) {
  const className =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "bad"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function formatScope(
  environments: string[],
  agentCount: number,
  t: ReturnType<typeof useTranslations<"firewall">>,
) {
  const environmentText =
    environments.length > 0
      ? environments.join(", ")
      : t("policies.allEnvironments");
  const agentText =
    agentCount > 0
      ? t("policies.selectedAgents", { count: agentCount })
      : t("policies.allAgents");
  return `${environmentText} · ${agentText}`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
