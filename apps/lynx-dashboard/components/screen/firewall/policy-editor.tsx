"use client";

import {
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
import {
  Check,
  ChevronDown,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { useCurrentWorkspace } from "@/hooks/use-current-workspace";
import {
  activateFirewallPolicy,
  createFirewallPolicy,
  deactivateFirewallPolicy,
  deleteFirewallPolicy,
  deployFirewallPolicy,
  getFirewallPolicy,
  listFirewallPolicyRevisions,
  listFirewallPolicyTargetOptions,
  listFirewallWebhookDeliveries,
  retryFirewallWebhookDelivery,
  rollbackFirewallPolicy,
  simulateFirewallPolicy,
  testFirewallPolicyWebhook,
  updateFirewallPolicy,
} from "@/lib/firewall";
import {
  createConditionGroup,
  createConditionRule,
  createDefaultConditionGroup,
  FIREWALL_CONDITION_FIELDS,
  type FirewallConditionGroup,
  type FirewallConditionNode,
  type FirewallConditionRule,
  type FirewallConditionValueType,
  getFirewallConditionFieldType,
  getFirewallConditionOperators,
  parseFirewallCondition,
  serializeFirewallCondition,
} from "@/lib/firewall-condition";

interface PolicyFormState {
  name: string;
  description: string;
  version: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  action: "ALLOW" | "WARN" | "BLOCK" | "REQUIRE_APPROVAL";
  webhookUrl: string;
  environments: string[];
  agentIds: string[];
  condition: string;
}

const DEFAULT_FORM: PolicyFormState = {
  name: "",
  description: "",
  version: "v1",
  severity: "HIGH",
  action: "WARN",
  webhookUrl: "",
  environments: [],
  agentIds: [],
  condition: "tool.riskLevel == 'CRITICAL'",
};

/** 새 정책 생성과 기존 정책 편집 작업 화면을 렌더링합니다. */
export function FirewallPolicyEditor({ policyId }: { policyId?: string }) {
  const t = useTranslations("firewall");
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspace = useCurrentWorkspace();
  const numericPolicyId = policyId ? Number(policyId) : undefined;
  const isEditing = Number.isFinite(numericPolicyId);
  const policyQuery = useQuery({
    queryKey: ["firewall", "policy", workspace.workspaceId, numericPolicyId],
    queryFn: () =>
      getFirewallPolicy(workspace.workspaceId, numericPolicyId as number),
    enabled: workspace.hasWorkspace && isEditing,
  });
  const revisionsQuery = useQuery({
    queryKey: [
      "firewall",
      "policy-revisions",
      workspace.workspaceId,
      numericPolicyId,
    ],
    queryFn: () =>
      listFirewallPolicyRevisions(
        workspace.workspaceId,
        numericPolicyId as number,
      ),
    enabled: workspace.hasWorkspace && isEditing,
  });
  const agentsQuery = useQuery({
    queryKey: ["firewall", "target-options", workspace.workspaceId],
    queryFn: () => listFirewallPolicyTargetOptions(workspace.workspaceId),
    enabled: workspace.hasWorkspace,
  });
  const webhookDeliveriesQuery = useQuery({
    queryKey: [
      "firewall",
      "webhook-deliveries",
      workspace.workspaceId,
      numericPolicyId,
    ],
    queryFn: () =>
      listFirewallWebhookDeliveries(
        workspace.workspaceId,
        numericPolicyId as number,
        { limit: 10 },
      ),
    enabled: workspace.hasWorkspace && isEditing,
    refetchInterval: 5_000,
  });
  const [form, setForm] = useState(DEFAULT_FORM);
  const [builder, setBuilder] = useState<FirewallConditionGroup>(
    createDefaultConditionGroup,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [inputJson, setInputJson] = useState('{\n  "amount": 1500\n}');
  const [outputText, setOutputText] = useState("");
  const [testTool, setTestTool] = useState({
    name: "transfer",
    riskLevel: "CRITICAL",
    sideEffect: true,
    externalTarget: "",
  });
  const [testState, setTestState] = useState({
    callCount: 1,
    totalCost: 0,
    elapsedMs: 0,
    loopCount: 0,
  });

  useEffect(() => {
    const policy = policyQuery.data?.policy;
    if (!policy) return;
    // 서버에서 비동기로 받은 초안을 편집 가능한 로컬 폼으로 한 번 복사합니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: policy.name,
      description: policy.description ?? "",
      version: policy.version,
      severity: policy.severity,
      action: policy.action,
      webhookUrl: policy.webhookUrl ?? "",
      environments: policy.environments,
      agentIds: policy.agentIds,
      condition: policy.condition,
    });
    setBuilder(
      parseFirewallCondition(policy.condition) ?? createDefaultConditionGroup(),
    );
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspace.workspaceId) throw new Error("WORKSPACE_REQUIRED");
      const input = {
        name: form.name,
        description: form.description || null,
        version: form.version,
        severity: form.severity,
        action: form.action,
        webhookUrl: form.webhookUrl || null,
        environments: form.environments,
        agentIds: form.agentIds,
        condition: form.condition,
      };
      if (!isEditing) {
        return createFirewallPolicy(workspace.workspaceId, input);
      }
      return updateFirewallPolicy(
        workspace.workspaceId,
        numericPolicyId as number,
        {
          ...input,
          expectedDraftRevision: policyQuery.data!.policy.draftRevision,
        },
      );
    },
    onSuccess: async (result) => {
      setMessage(t("editor.saved"));
      await queryClient.invalidateQueries({ queryKey: ["firewall"] });
      if (!isEditing) {
        router.replace(`/firewall/policies/${result.policy.id}`);
      }
    },
    onError: (error) => {
      setMessage(
        String(error).includes("409")
          ? t("editor.conflict")
          : t("editor.saveFailed"),
      );
    },
  });

  const deployMutation = usePolicyMutation(async () => {
    await deployFirewallPolicy(
      workspace.workspaceId,
      numericPolicyId as number,
    );
    setMessage(t("editor.deployed"));
  });
  const activationMutation = usePolicyMutation(async () => {
    const policy = policyQuery.data!.policy;
    if (policy.activated) {
      await deactivateFirewallPolicy(
        workspace.workspaceId,
        numericPolicyId as number,
      );
      setMessage(t("editor.deactivated"));
    } else {
      await activateFirewallPolicy(
        workspace.workspaceId,
        numericPolicyId as number,
      );
      setMessage(t("editor.activated"));
    }
  });
  const deleteMutation = usePolicyMutation(async () => {
    if (!window.confirm(t("editor.deleteConfirm"))) return;
    await deleteFirewallPolicy(
      workspace.workspaceId,
      numericPolicyId as number,
    );
    router.replace("/firewall/policies");
  });
  const rollbackMutation = usePolicyMutation(async (revision: number) => {
    await rollbackFirewallPolicy(
      workspace.workspaceId,
      numericPolicyId as number,
      revision,
    );
    setMessage(t("editor.rolledBack", { revision }));
  });
  const webhookTestMutation = useMutation({
    mutationFn: () =>
      testFirewallPolicyWebhook(
        workspace.workspaceId,
        numericPolicyId as number,
      ),
    onSuccess: async () => {
      setMessage(t("editor.webhookTestQueued"));
      await queryClient.invalidateQueries({
        queryKey: ["firewall", "webhook-deliveries"],
      });
    },
    onError: () => setMessage(t("editor.webhookTestFailed")),
  });
  const webhookRetryMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      retryFirewallWebhookDelivery(
        workspace.workspaceId,
        numericPolicyId as number,
        deliveryId,
      ),
    onSuccess: async () => {
      setMessage(t("editor.webhookRetryQueued"));
      await queryClient.invalidateQueries({
        queryKey: ["firewall", "webhook-deliveries"],
      });
    },
    onError: () => setMessage(t("editor.webhookRetryFailed")),
  });
  const simulation = useMutation({
    mutationFn: async () => {
      if (!isEditing) throw new Error("SAVE_REQUIRED");
      let input: unknown;
      try {
        input = JSON.parse(inputJson);
      } catch {
        throw new Error("INVALID_JSON");
      }
      return simulateFirewallPolicy(
        workspace.workspaceId,
        numericPolicyId as number,
        {
          tool: {
            name: testTool.name,
            riskLevel: testTool.riskLevel as
              | "LOW"
              | "MEDIUM"
              | "HIGH"
              | "CRITICAL",
            sideEffect: testTool.sideEffect,
            externalTarget: testTool.externalTarget || undefined,
          },
          input,
          output: outputText,
          state: testState,
        },
      );
    },
  });

  function usePolicyMutation<TInput = void>(
    mutationFn: (input: TInput) => Promise<void>,
  ) {
    return useMutation({
      mutationFn,
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["firewall"] });
      },
      onError: () => setMessage(t("editor.actionFailed")),
    });
  }

  const isPending =
    workspace.isPending ||
    agentsQuery.isPending ||
    (isEditing && (policyQuery.isPending || revisionsQuery.isPending));
  if (isPending) return <ActualDataPageLoading />;
  if (
    workspace.isError ||
    agentsQuery.isError ||
    (isEditing && (policyQuery.isError || revisionsQuery.isError))
  ) {
    return (
      <ActualDataPageMessage
        pageTitle={t("editor.title")}
        pageDescription={t("editor.subtitle")}
        title={t("common.errorTitle")}
        description={t("common.errorDescription")}
      />
    );
  }

  const policy = policyQuery.data?.policy;
  const revisions = revisionsQuery.data?.items ?? [];
  const deployedRevision = revisions.find((revision) => revision.isDeployed);
  const changedFields = deployedRevision
    ? getChangedFields(form, deployedRevision)
    : [];

  function updateBuilder(next: FirewallConditionGroup) {
    setBuilder(next);
    setForm((current) => ({
      ...current,
      condition: serializeFirewallCondition(next),
    }));
  }

  function applyRawDsl() {
    const parsed = parseFirewallCondition(form.condition);
    if (!parsed) {
      setMessage(t("editor.invalidDsl"));
      return;
    }
    setBuilder(parsed);
    setMessage(t("editor.dslApplied"));
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={
          isEditing ? form.name || t("editor.title") : t("editor.newTitle")
        }
        description={t("editor.subtitle")}
        badge={
          policy ? (
            <StatusBadge
              label={
                policy.isDirty
                  ? t("status.deployRequired")
                  : t("status.deployed")
              }
              tone={policy.isDirty ? "warning" : "good"}
            />
          ) : null
        }
        actions={
          isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => activationMutation.mutate()}
                disabled={
                  activationMutation.isPending ||
                  (policy?.deployedRevision === null && !policy.activated)
                }
              >
                {policy?.activated
                  ? t("editor.deactivate")
                  : t("editor.activate")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {t("editor.delete")}
              </Button>
            </>
          ) : null
        }
      />

      {message ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <DashboardPanel>
            <DashboardSectionHeader
              title={t("editor.basicTitle")}
              description={t("editor.basicDescription")}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField label={t("editor.name")}>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </FormField>
              <FormField label={t("editor.version")}>
                <Input
                  value={form.version}
                  onChange={(event) =>
                    setForm({ ...form, version: event.target.value })
                  }
                />
              </FormField>
              <FormField
                label={t("editor.description")}
                className="sm:col-span-2"
              >
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </FormField>
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <DashboardSectionHeader
              title={t("editor.scopeTitle")}
              description={t("editor.scopeDescription")}
            />
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <FormField label={t("editor.environments")}>
                <Input
                  placeholder={t("editor.environmentsPlaceholder")}
                  value={form.environments.join(", ")}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      environments: splitCommaList(event.target.value),
                    })
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("editor.emptyMeansAll")}
                </p>
              </FormField>
              <FormField label={t("editor.agents")}>
                <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-2">
                  {(agentsQuery.data?.agents ?? []).map((agent) => (
                    <label
                      className="flex items-center gap-2 text-sm"
                      key={agent.id}
                    >
                      <input
                        type="checkbox"
                        checked={form.agentIds.includes(agent.id)}
                        onChange={() =>
                          setForm({
                            ...form,
                            agentIds: toggleValue(form.agentIds, agent.id),
                          })
                        }
                      />
                      <span>{agent.name}</span>
                    </label>
                  ))}
                  {(agentsQuery.data?.agents.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("editor.noAgents")}
                    </p>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("editor.emptyMeansAll")}
                </p>
              </FormField>
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <DashboardSectionHeader
              title={t("builder.title")}
              description={t("builder.description")}
            />
            <div className="mt-4">
              <ConditionGroupEditor
                group={builder}
                onChange={updateBuilder}
                t={t}
              />
            </div>
            <details className="mt-5 border-t pt-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <ChevronDown className="size-4" />
                {t("editor.advancedDsl")}
              </summary>
              <Textarea
                className="mt-3 min-h-28 font-mono text-xs"
                value={form.condition}
                onChange={(event) =>
                  setForm({ ...form, condition: event.target.value })
                }
              />
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={applyRawDsl}
              >
                {t("editor.applyDsl")}
              </Button>
            </details>
          </DashboardPanel>

          <DashboardPanel>
            <DashboardSectionHeader
              title={t("editor.decisionTitle")}
              description={t("editor.decisionDescription")}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <FormField label={t("editor.action")}>
                <Select
                  value={form.action}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      action: value as PolicyFormState["action"],
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["WARN", "BLOCK", "REQUIRE_APPROVAL", "ALLOW"].map(
                      (action) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("editor.severity")}>
                <Select
                  value={form.severity}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      severity: value as PolicyFormState["severity"],
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {severity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("editor.webhook")}>
                <Input
                  placeholder="https://"
                  value={form.webhookUrl}
                  onChange={(event) =>
                    setForm({ ...form, webhookUrl: event.target.value })
                  }
                />
              </FormField>
            </div>
          </DashboardPanel>

          {isEditing ? (
            <DashboardPanel>
              <DashboardSectionHeader
                title={t("editor.webhookOperationsTitle")}
                description={t("editor.webhookOperationsDescription")}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !form.webhookUrl ||
                      form.webhookUrl !== (policy?.webhookUrl ?? "") ||
                      webhookTestMutation.isPending
                    }
                    onClick={() => webhookTestMutation.mutate()}
                  >
                    <Send />
                    {webhookTestMutation.isPending
                      ? t("editor.webhookTesting")
                      : t("editor.webhookTest")}
                  </Button>
                }
              />
              {form.webhookUrl !== (policy?.webhookUrl ?? "") ? (
                <p className="mt-4 text-sm text-amber-700">
                  {t("editor.webhookSaveBeforeTest")}
                </p>
              ) : null}
              {webhookDeliveriesQuery.isError ? (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  {t("editor.webhookHistoryError")}
                </p>
              ) : webhookDeliveriesQuery.isPending ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("editor.webhookHistoryLoading")}
                </p>
              ) : (
                <div className="mt-4 divide-y">
                  {(webhookDeliveriesQuery.data?.items ?? []).map(
                    (delivery) => (
                      <div className="py-3" key={delivery.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {delivery.eventType}
                              </p>
                              <StatusBadge
                                label={t(
                                  `editor.webhookStatuses.${delivery.status}`,
                                )}
                                tone={getWebhookStatusTone(delivery.status)}
                              />
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {delivery.destination} ·{" "}
                              {new Date(delivery.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {(delivery.status === "FAILED" ||
                            delivery.status === "RETRY_SCHEDULED") && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={webhookRetryMutation.isPending}
                              onClick={() =>
                                webhookRetryMutation.mutate(delivery.id)
                              }
                            >
                              <RotateCcw />
                              {t("editor.webhookRetry")}
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("editor.webhookAttempt", {
                            count: delivery.attemptCount,
                            max: delivery.maxAttempts,
                            status: delivery.responseStatus ?? "-",
                          })}
                        </p>
                        {delivery.lastError ? (
                          <p className="mt-1 break-all text-xs text-destructive">
                            {delivery.lastError}
                          </p>
                        ) : null}
                      </div>
                    ),
                  )}
                  {(webhookDeliveriesQuery.data?.items.length ?? 0) === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("editor.webhookHistoryEmpty")}
                    </p>
                  ) : null}
                </div>
              )}
            </DashboardPanel>
          ) : null}

          {isEditing ? (
            <DashboardPanel>
              <DashboardSectionHeader
                title={t("editor.revisionsTitle")}
                description={t("editor.revisionsDescription")}
              />
              {changedFields.length > 0 ? (
                <p className="mt-4 text-sm text-amber-700">
                  {t("editor.changedFields", {
                    fields: changedFields.join(", "),
                  })}
                </p>
              ) : null}
              <div className="mt-3 divide-y">
                {revisions.map((revision) => (
                  <div
                    className="flex items-center justify-between gap-3 py-3"
                    key={revision.id}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        r{revision.revision} · {revision.version}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {revision.deployedAt
                          ? new Date(revision.deployedAt).toLocaleString()
                          : t("editor.notDeployed")}
                      </p>
                    </div>
                    {revision.isDeployed ? (
                      <StatusBadge label={t("status.deployed")} tone="good" />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          rollbackMutation.mutate(revision.revision)
                        }
                      >
                        {t("editor.rollback")}
                      </Button>
                    )}
                  </div>
                ))}
                {revisions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("editor.noRevisions")}
                  </p>
                ) : null}
              </div>
            </DashboardPanel>
          ) : null}
        </div>

        <div className="space-y-6 xl:sticky xl:top-5 xl:self-start">
          <DashboardPanel>
            <DashboardSectionHeader
              title={t("test.title")}
              description={t("test.description")}
            />
            <div className="mt-4 space-y-3">
              <FormField label={t("test.toolName")}>
                <Input
                  value={testTool.name}
                  onChange={(event) =>
                    setTestTool({ ...testTool, name: event.target.value })
                  }
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("test.riskLevel")}>
                  <Select
                    value={testTool.riskLevel}
                    onValueChange={(value) =>
                      setTestTool({
                        ...testTool,
                        riskLevel: value,
                      })
                    }
                  >
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
                </FormField>
                <FormField label={t("test.sideEffect")}>
                  <Select
                    value={String(testTool.sideEffect)}
                    onValueChange={(value) =>
                      setTestTool({
                        ...testTool,
                        sideEffect: value === "true",
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{t("common.yes")}</SelectItem>
                      <SelectItem value="false">{t("common.no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label={t("test.externalTarget")}>
                <Input
                  value={testTool.externalTarget}
                  onChange={(event) =>
                    setTestTool({
                      ...testTool,
                      externalTarget: event.target.value,
                    })
                  }
                />
              </FormField>
              <FormField label={t("test.inputJson")}>
                <Textarea
                  className="min-h-32 font-mono text-xs"
                  value={inputJson}
                  onChange={(event) => setInputJson(event.target.value)}
                />
              </FormField>
              <FormField label={t("test.outputText")}>
                <Textarea
                  className="min-h-24 text-sm"
                  value={outputText}
                  onChange={(event) => setOutputText(event.target.value)}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["callCount", "test.callCount"],
                    ["totalCost", "test.totalCost"],
                    ["elapsedMs", "test.elapsedMs"],
                    ["loopCount", "test.loopCount"],
                  ] as const
                ).map(([field, label]) => (
                  <FormField label={t(label)} key={field}>
                    <Input
                      type="number"
                      min={0}
                      value={testState[field]}
                      onChange={(event) =>
                        setTestState({
                          ...testState,
                          [field]: Number(event.target.value),
                        })
                      }
                    />
                  </FormField>
                ))}
              </div>
              <Button
                className="w-full"
                variant="outline"
                disabled={!isEditing || simulation.isPending}
                onClick={() => simulation.mutate()}
              >
                {simulation.isPending ? t("test.running") : t("test.run")}
              </Button>
              {!isEditing ? (
                <p className="text-xs text-muted-foreground">
                  {t("test.saveFirst")}
                </p>
              ) : null}
            </div>
          </DashboardPanel>

          {simulation.data ? (
            <DashboardPanel>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {t("test.resultTitle")}
                </h2>
                <StatusBadge
                  label={
                    simulation.data.matched
                      ? t("test.matched")
                      : t("test.notMatched")
                  }
                  tone={simulation.data.matched ? "bad" : "good"}
                />
              </div>
              <div className="mt-3 space-y-2">
                {simulation.data.conditions.map((condition, index) => (
                  <div
                    className="flex gap-2 rounded-md border px-3 py-2 text-xs"
                    key={`${condition.expression}-${index}`}
                  >
                    {condition.matched ? (
                      <Check className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="size-4 shrink-0 text-rose-600" />
                    )}
                    <div className="min-w-0">
                      <p className="break-all font-mono">
                        {condition.expression}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {t("test.actualValue", {
                          value: formatValue(condition.actual),
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          ) : null}

          <DashboardPanel>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => saveMutation.mutate()}
                disabled={
                  !form.name || !form.condition || saveMutation.isPending
                }
              >
                {saveMutation.isPending
                  ? t("editor.saving")
                  : t("editor.saveDraft")}
              </Button>
              {isEditing ? (
                <Button
                  onClick={() => deployMutation.mutate()}
                  disabled={deployMutation.isPending}
                >
                  {deployMutation.isPending
                    ? t("editor.deploying")
                    : t("editor.deploy")}
                </Button>
              ) : null}
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}

function ConditionGroupEditor({
  group,
  onChange,
  t,
  depth = 0,
}: {
  group: FirewallConditionGroup;
  onChange: (group: FirewallConditionGroup) => void;
  t: ReturnType<typeof useTranslations<"firewall">>;
  depth?: number;
}) {
  function updateChild(child: FirewallConditionNode) {
    onChange({
      ...group,
      children: group.children.map((item) =>
        item.id === child.id ? child : item,
      ),
    });
  }

  return (
    <div className={depth > 0 ? "rounded-md border bg-muted/20 p-3" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("builder.match")}</span>
        <Select
          value={group.combinator}
          onValueChange={(value) =>
            onChange({
              ...group,
              combinator: value as FirewallConditionGroup["combinator"],
            })
          }
        >
          <SelectTrigger className="h-8 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">{t("builder.all")}</SelectItem>
            <SelectItem value="OR">{t("builder.any")}</SelectItem>
          </SelectContent>
        </Select>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={group.negated}
            onChange={(event) =>
              onChange({ ...group, negated: event.target.checked })
            }
          />
          {t("builder.not")}
        </label>
      </div>
      <div className="mt-3 space-y-2">
        {group.children.map((child) =>
          child.type === "rule" ? (
            <ConditionRuleEditor
              key={child.id}
              rule={child}
              onChange={updateChild}
              onRemove={() =>
                onChange({
                  ...group,
                  children: group.children.filter(
                    (item) => item.id !== child.id,
                  ),
                })
              }
              t={t}
            />
          ) : (
            <div className="relative" key={child.id}>
              <ConditionGroupEditor
                group={child}
                onChange={updateChild}
                t={t}
                depth={depth + 1}
              />
              <Button
                className="absolute right-2 top-2"
                size="icon-xs"
                variant="ghost"
                aria-label={t("builder.remove")}
                onClick={() =>
                  onChange({
                    ...group,
                    children: group.children.filter(
                      (item) => item.id !== child.id,
                    ),
                  })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, createConditionRule()],
            })
          }
        >
          <Plus />
          {t("builder.addCondition")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, createConditionGroup()],
            })
          }
        >
          <Plus />
          {t("builder.addGroup")}
        </Button>
      </div>
    </div>
  );
}

function ConditionRuleEditor({
  rule,
  onChange,
  onRemove,
  t,
}: {
  rule: FirewallConditionRule;
  onChange: (rule: FirewallConditionRule) => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations<"firewall">>;
}) {
  const knownField = FIREWALL_CONDITION_FIELDS.some(
    (field) => field.value === rule.field,
  );
  const selectedField = knownField ? rule.field : "input.custom";
  const operators = getFirewallConditionOperators(rule.valueType);

  function selectField(field: string) {
    const actualField = field === "input.custom" ? "input.value" : field;
    const valueType = getFirewallConditionFieldType(actualField);
    onChange({
      ...rule,
      field: actualField,
      valueType,
      operator: getFirewallConditionOperators(valueType)[0]!,
      value: valueType === "boolean" ? "true" : "",
    });
  }

  return (
    <div className="grid gap-2 rounded-md border px-3 py-3 lg:grid-cols-[1.2fr_0.8fr_1fr_auto]">
      <div className="space-y-2">
        <Select value={selectedField} onValueChange={selectField}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIREWALL_CONDITION_FIELDS.map((field) => (
              <SelectItem key={field.value} value={field.value}>
                {t(`builder.fields.${field.value.replaceAll(".", "_")}`)}
              </SelectItem>
            ))}
            <SelectItem value="input.custom">
              {t("builder.fields.input_custom")}
            </SelectItem>
          </SelectContent>
        </Select>
        {selectedField === "input.custom" ? (
          <Input
            aria-label={t("builder.inputPath")}
            placeholder="input.amount"
            value={rule.field}
            onChange={(event) =>
              onChange({
                ...rule,
                field: normalizeInputPath(event.target.value),
              })
            }
          />
        ) : null}
      </div>
      <Select
        value={rule.operator}
        onValueChange={(value) => onChange({ ...rule, operator: value })}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((operator) => (
            <SelectItem value={operator} key={operator}>
              {t(`builder.operators.${operatorToKey(operator)}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        {selectedField === "input.custom" ? (
          <Select
            value={rule.valueType}
            onValueChange={(value) => {
              const valueType = value as FirewallConditionValueType;
              onChange({
                ...rule,
                valueType,
                operator: getFirewallConditionOperators(valueType)[0]!,
                value: valueType === "boolean" ? "true" : "",
              });
            }}
          >
            <SelectTrigger className="h-9 min-w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">
                {t("builder.types.string")}
              </SelectItem>
              <SelectItem value="number">
                {t("builder.types.number")}
              </SelectItem>
              <SelectItem value="boolean">
                {t("builder.types.boolean")}
              </SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {rule.valueType === "boolean" ? (
          <Select
            value={rule.value}
            onValueChange={(value) => onChange({ ...rule, value })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("common.yes")}</SelectItem>
              <SelectItem value="false">{t("common.no")}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            type={rule.valueType === "number" ? "number" : "text"}
            value={rule.value}
            onChange={(event) =>
              onChange({ ...rule, value: event.target.value })
            }
          />
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("builder.remove")}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function getWebhookStatusTone(
  status: "PENDING" | "PROCESSING" | "RETRY_SCHEDULED" | "DELIVERED" | "FAILED",
): "good" | "warning" | "bad" | "neutral" {
  if (status === "DELIVERED") return "good";
  if (status === "FAILED") return "bad";
  if (status === "RETRY_SCHEDULED") return "warning";
  return "neutral";
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "warning" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "bad"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${toneClass}`}>
      {label}
    </span>
  );
}

function splitCommaList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function normalizeInputPath(value: string): string {
  const path = value.trim().replace(/^input\.?/, "");
  return `input.${path.replace(/[^A-Za-z0-9_.-]/g, "")}`;
}

function operatorToKey(operator: string): string {
  return {
    "==": "equals",
    "!=": "notEquals",
    contains: "contains",
    ">": "greater",
    ">=": "greaterOrEqual",
    "<": "less",
    "<=": "lessOrEqual",
  }[operator]!;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function getChangedFields(
  form: PolicyFormState,
  deployed: {
    name: string;
    description?: string | null;
    version: string;
    condition: string;
    severity: string;
    action: string;
    webhookUrl?: string | null;
    environments: string[];
    agentIds: string[];
  },
) {
  const fields: (keyof PolicyFormState)[] = [
    "name",
    "description",
    "version",
    "condition",
    "severity",
    "action",
    "webhookUrl",
    "environments",
    "agentIds",
  ];
  return fields.filter((field) => {
    const current = form[field];
    const previous = deployed[field];
    return Array.isArray(current)
      ? JSON.stringify([...current].sort()) !==
          JSON.stringify([...(previous as string[])].sort())
      : (current || "") !== (previous || "");
  });
}
