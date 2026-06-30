"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  DashboardMetricCard,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import type {
  WorkspaceApiKeyDto,
  WorkspaceApiKeyPermission,
  WorkspaceDetailDto,
  WorkspacePlanValue,
} from "@repo/dto";
import {
  useCreateWorkspaceApiKeyMutation,
  useRevokeWorkspaceApiKeyMutation,
  useUpdateWorkspaceApiKeyMutation,
  useWorkspaceApiKeysQuery,
  useUpdateWorkspaceMutation,
  useWorkspaceDetailQuery,
} from "@/hooks/queries/workspace";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";
import { UsePageInfo } from "@/components/util/set-pageinfo";

export type SettingsPageKind =
  | "general"
  | "members"
  | "roles"
  | "billing"
  | "api-keys"
  | "sdk"
  | "webhooks"
  | "slack"
  | "notification-channels"
  | "notification-rules"
  | "notification-preferences";

const demoWorkspace = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Production",
  plan: "PRO" as WorkspacePlanValue,
  apiKey: "lynx_demo_key_for_local_preview",
  organization: {
    id: "00000000-0000-4000-8000-000000000000",
    name: "Lynx Demo",
  },
};

const demoApiKeys: WorkspaceApiKeyDto[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    trackingId: "key_demo_prod_ingest",
    name: "production-ingest",
    status: "ACTIVE",
    prefix: "lynx_demo_prod_",
    secretPreview: "lynx_demo_prod_...",
    scopes: ["events:write"],
    permission: "RESTRICTED",
    createdAt: "2026-06-30T10:00:00.000Z",
    lastUsedAt: "2026-06-30T11:24:00.000Z",
    createdByName: "Demo Admin",
    monthlySpend: 12.48,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    trackingId: "key_demo_sdk_read",
    name: "sdk-read-config",
    status: "ACTIVE",
    prefix: "lynx_demo_read_",
    secretPreview: "lynx_demo_read_...",
    scopes: ["config:read", "policies:read"],
    permission: "READ_ONLY",
    createdAt: "2026-06-24T09:12:00.000Z",
    createdByName: "Demo Admin",
    monthlySpend: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    trackingId: "key_demo_old",
    name: "old-secret",
    status: "REVOKED",
    prefix: "lynx_demo_old_",
    secretPreview: "lynx_demo_old_...",
    scopes: ["events:write"],
    permission: "RESTRICTED",
    createdAt: "2026-05-12T07:40:00.000Z",
    lastUsedAt: "2026-06-01T15:10:00.000Z",
    revokedAt: "2026-06-11T08:30:00.000Z",
    createdByName: "Demo Admin",
    monthlySpend: 3.92,
  },
];

type SettingsWorkspace = WorkspaceDetailDto;

export function SettingsPageView({ kind }: { kind: SettingsPageKind }) {
  const t = useTranslations("settings");
  const sidebarT = useTranslations("sidebar");
  const dashboardT = useTranslations("dashboard.breadcrumbs");
  const selectedWorkspaceId = useDashboardUiStore(
    (state) => state.selectedWorkspaceId,
  );
  const workspaceQuery = useWorkspaceDetailQuery(selectedWorkspaceId);
  const workspace =
    workspaceQuery.data ?? (runtimeConfig.demoMode ? demoWorkspace : undefined);
  const page = getSettingsPage(kind, t);

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: dashboardT("dashboard"), url: "/dashboard" },
          { title: sidebarT("settings.title"), url: "/settings/general" },
          { title: page.title, url: page.href },
        ]}
      />

      <DashboardPageHeader
        title={page.title}
        description={page.description}
        badge={<StatusPill label={page.statusLabel} tone={page.statusTone} />}
      />

      {!workspace ? (
        <DashboardPanel>
          <p className="text-sm font-medium">{t("empty.workspaceTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("empty.workspaceDescription")}
          </p>
        </DashboardPanel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <SettingsSummary page={page} workspace={workspace} />
            {renderSettingsBody(kind, workspace, t)}
          </section>
          <SettingsSidePanel workspace={workspace} t={t} />
        </div>
      )}
    </main>
  );
}

function SettingsSummary({
  page,
  workspace,
}: {
  page: SettingsPage;
  workspace: SettingsWorkspace;
}) {
  const [workspaceSummary, planSummary, securitySummary] = page.summary;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <DashboardMetricCard
        label={workspaceSummary.label}
        value={workspace.name}
        description={workspaceSummary.description}
      />
      <DashboardMetricCard
        label={planSummary.label}
        value={workspace.plan}
        description={planSummary.description}
      />
      <DashboardMetricCard
        label={securitySummary.label}
        value={securitySummary.value}
        description={securitySummary.description}
        tone={securitySummary.tone}
      />
    </section>
  );
}

function renderSettingsBody(
  kind: SettingsPageKind,
  workspace: SettingsWorkspace,
  t: ReturnType<typeof useTranslations<"settings">>,
) {
  if (kind === "general") {
    return <GeneralSettings workspace={workspace} t={t} />;
  }
  if (kind === "api-keys") {
    return <ApiKeySettings workspace={workspace} t={t} />;
  }
  if (kind === "sdk") {
    return <SdkSettings workspace={workspace} t={t} />;
  }

  return <ChecklistSettings kind={kind} t={t} />;
}

function GeneralSettings({
  workspace,
  t,
}: {
  workspace: SettingsWorkspace;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const [name, setName] = useState(workspace.name);
  const updateMutation = useUpdateWorkspaceMutation(workspace.id);

  useEffect(() => {
    setName(workspace.name);
  }, [workspace.name]);

  const hasChanges = name.trim() !== workspace.name;

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("general.form.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("general.form.description")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">{t("general.form.name")}</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-plan">{t("general.form.plan")}</Label>
          <Input
            id="workspace-plan"
            value={getPlanLabel(workspace.plan, t)}
            readOnly
            aria-readonly="true"
          />
          <p className="text-xs text-muted-foreground">
            {t("general.form.planReadonly")}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          disabled={!hasChanges || updateMutation.isPending}
          onClick={() =>
            updateMutation.mutate({
              name: name.trim(),
            })
          }
        >
          <Save />
          {updateMutation.isPending
            ? t("common.saving")
            : t("common.saveChanges")}
        </Button>
      </div>
    </DashboardPanel>
  );
}

function getPlanLabel(
  plan: WorkspacePlanValue,
  t: ReturnType<typeof useTranslations<"settings">>,
) {
  if (plan === "FREE" || plan === "PRO" || plan === "ENTERPRISE") {
    return t(`plans.${plan}`);
  }

  return plan;
}

function ApiKeySettings({
  workspace,
  t,
}: {
  workspace: SettingsWorkspace;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const apiKeysQuery = useWorkspaceApiKeysQuery(workspace.id);
  const createMutation = useCreateWorkspaceApiKeyMutation(workspace.id);
  const updateMutation = useUpdateWorkspaceApiKeyMutation(workspace.id);
  const revokeMutation = useRevokeWorkspaceApiKeyMutation(workspace.id);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<WorkspaceApiKeyDto | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const apiKeys =
    apiKeysQuery.data ?? (runtimeConfig.demoMode ? demoApiKeys : []);

  const filteredApiKeys = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return apiKeys.filter((apiKey) => {
      const matchesStatus =
        statusFilter === "ALL" || apiKey.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [
          apiKey.name,
          apiKey.trackingId,
          apiKey.secretPreview,
          apiKey.createdByName,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [apiKeys, search, statusFilter]);

  const activeCount = apiKeys.filter((apiKey) => apiKey.status === "ACTIVE")
    .length;

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t("apiKeys.title")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("apiKeys.description")}
          </p>
        </div>
        <Button
          onClick={() => {
            setCreatedSecret(null);
            setIsCreateOpen(true);
          }}
        >
          <Plus />
          {t("apiKeys.actions.create")}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-0 md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("apiKeys.search")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button
            type="button"
            variant={statusFilter === "ACTIVE" ? "secondary" : "outline"}
            onClick={() => setStatusFilter("ACTIVE")}
          >
            <Check />
            {t("apiKeys.filters.active")}
          </Button>
          <Button
            type="button"
            variant={statusFilter === "ALL" ? "secondary" : "outline"}
            onClick={() => setStatusFilter("ALL")}
          >
            {t("apiKeys.filters.all")}
          </Button>
          <span>
            {t("apiKeys.results", { count: filteredApiKeys.length })}
          </span>
        </div>
      </div>

      {createdSecret ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{t("apiKeys.created.title")}</p>
              <p className="mt-1 text-emerald-800">
                {t("apiKeys.created.description")}
              </p>
              <p className="mt-2 truncate font-mono text-xs">
                {createdSecret}
              </p>
            </div>
            <CopyButton
              value={createdSecret}
              label={t("common.copy")}
              copiedLabel={t("common.copied")}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/60">
        <div className="grid min-w-[1280px] grid-cols-[minmax(180px,1.5fr)_110px_minmax(190px,1fr)_minmax(160px,1fr)_120px_minmax(120px,0.8fr)_minmax(140px,0.8fr)_110px_120px_76px] bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("apiKeys.table.name")}</span>
          <span>{t("apiKeys.table.status")}</span>
          <span>{t("apiKeys.table.trackingId")}</span>
          <span>{t("apiKeys.table.secret")}</span>
          <span>{t("apiKeys.table.created")}</span>
          <span>{t("apiKeys.table.lastUsed")}</span>
          <span>{t("apiKeys.table.createdBy")}</span>
          <span>{t("apiKeys.table.permission")}</span>
          <span>{t("apiKeys.table.monthlySpend")}</span>
          <span className="text-right">{t("apiKeys.table.actions")}</span>
        </div>

        {apiKeysQuery.isLoading && !runtimeConfig.demoMode ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("apiKeys.loading")}
          </div>
        ) : filteredApiKeys.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("apiKeys.empty")}
          </div>
        ) : (
          filteredApiKeys.map((apiKey) => (
            <div
              key={apiKey.id}
              className="grid min-w-[1280px] grid-cols-[minmax(180px,1.5fr)_110px_minmax(190px,1fr)_minmax(160px,1fr)_120px_minmax(120px,0.8fr)_minmax(140px,0.8fr)_110px_120px_76px] items-center border-t border-border/60 px-3 py-3 text-sm"
            >
              <span className="truncate font-medium">{apiKey.name}</span>
              <span>
                <ApiKeyStatusBadge apiKey={apiKey} t={t} />
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {apiKey.trackingId}
              </span>
              <span className="truncate font-mono text-xs">
                {apiKey.secretPreview}
              </span>
              <span className="text-muted-foreground">
                {formatDate(apiKey.createdAt)}
              </span>
              <span className="text-muted-foreground">
                {apiKey.lastUsedAt
                  ? formatDate(apiKey.lastUsedAt)
                  : t("apiKeys.never")}
              </span>
              <span className="truncate text-muted-foreground">
                {apiKey.createdByName ?? "-"}
              </span>
              <span>{getPermissionLabel(apiKey.permission, t)}</span>
              <span className="text-muted-foreground">
                {formatCurrency(apiKey.monthlySpend)}
              </span>
              <div className="flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={apiKey.status !== "ACTIVE"}
                  aria-label={t("apiKeys.actions.edit")}
                  onClick={() => setEditingKey(apiKey)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={
                    apiKey.status !== "ACTIVE" || revokeMutation.isPending
                  }
                  aria-label={t("apiKeys.actions.revoke")}
                  onClick={() => {
                    if (window.confirm(t("apiKeys.confirmRevoke"))) {
                      revokeMutation.mutate(apiKey.id);
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {t("apiKeys.summary", {
          active: activeCount,
          total: apiKeys.length,
        })}
      </div>

      <SettingsChecklist
        title={t("apiKeys.safety.title")}
        items={getTranslatedList(t, "apiKeys.safety.items", 3)}
      />

      {isCreateOpen ? (
        <ApiKeyDialog
          mode="create"
          title={t("apiKeys.dialog.createTitle")}
          submitLabel={t("apiKeys.actions.create")}
          isPending={createMutation.isPending}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(values) => {
            createMutation.mutate(values, {
              onSuccess: (result) => {
                setCreatedSecret(result.apiKey);
                setIsCreateOpen(false);
              },
            });
          }}
          t={t}
        />
      ) : null}

      {editingKey ? (
        <ApiKeyDialog
          mode="edit"
          title={t("apiKeys.dialog.editTitle")}
          submitLabel={t("common.saveChanges")}
          initialName={editingKey.name}
          initialPermission={editingKey.permission}
          isPending={updateMutation.isPending}
          onClose={() => setEditingKey(null)}
          onSubmit={(values) => {
            updateMutation.mutate(
              { apiKeyId: editingKey.id, body: values },
              {
                onSuccess: () => setEditingKey(null),
              },
            );
          }}
          t={t}
        />
      ) : null}
    </DashboardPanel>
  );
}

function ApiKeyDialog({
  mode,
  title,
  submitLabel,
  initialName = "",
  initialPermission = "RESTRICTED",
  isPending,
  onClose,
  onSubmit,
  t,
}: {
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  initialName?: string;
  initialPermission?: WorkspaceApiKeyPermission;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    permission: WorkspaceApiKeyPermission;
  }) => void;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const [name, setName] = useState(initialName);
  const [permission, setPermission] =
    useState<WorkspaceApiKeyPermission>(initialPermission);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      permission,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? t("apiKeys.dialog.createDescription")
                : t("apiKeys.dialog.editDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="api-key-name">{t("apiKeys.dialog.name")}</Label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("apiKeys.dialog.namePlaceholder")}
            maxLength={120}
          />
        </div>

        <div className="mt-5 space-y-2">
          <Label>{t("apiKeys.dialog.permissions")}</Label>
          <div className="grid grid-cols-3 rounded-lg border border-border bg-muted/40 p-1">
            {(["ALL", "RESTRICTED", "READ_ONLY"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-md px-2 py-2 text-sm font-medium transition ${
                  permission === item
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setPermission(item)}
              >
                {getPermissionLabel(item, t)}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t(`apiKeys.permissions.${permission}.description`)}
          </p>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("common.saving") : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ApiKeyStatusBadge({
  apiKey,
  t,
}: {
  apiKey: WorkspaceApiKeyDto;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const className =
    apiKey.status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : apiKey.status === "EXPIRED"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${className}`}
    >
      {t(`apiKeys.status.${apiKey.status}`)}
    </span>
  );
}

function SdkSettings({
  workspace,
  t,
}: {
  workspace: SettingsWorkspace;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const apiKey = workspace.apiKey ?? "lynx_xxx";
  const envExample = useMemo(
    () =>
      [
        `LYNX_ENDPOINT=${getClientEndpoint()}`,
        `LYNX_API_KEY=${apiKey}`,
        `LYNX_WORKSPACE_ID=${workspace.id}`,
        "LYNX_CAPTURE_MODE=smart",
        "LYNX_DELIVERY_MODE=BACKGROUND",
        "LYNX_DELIVERY_TIMEOUT_MS=1000",
        "LYNX_DELIVERY_FLUSH_ON_RUN_END=false",
        "LYNX_CIRCUIT_BREAKER_ENABLED=true",
      ].join("\n"),
    [apiKey, workspace.id],
  );

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t("sdk.env.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("sdk.env.description")}
        </p>
      </div>

      <div className="mt-5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-6">
          {envExample}
        </pre>
      </div>

      <div className="mt-3 flex justify-end">
        <CopyButton
          value={envExample}
          label={t("sdk.env.copy")}
          copiedLabel={t("common.copied")}
        />
      </div>

      <SettingsChecklist
        title={t("sdk.policy.title")}
        items={getTranslatedList(t, "sdk.policy.items", 4)}
      />
    </DashboardPanel>
  );
}

function ChecklistSettings({
  kind,
  t,
}: {
  kind: SettingsPageKind;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  const namespace = `pages.${kind}`;

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">
          {t(`${namespace}.panelTitle`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`${namespace}.panelDescription`)}
        </p>
      </div>
      <SettingsChecklist
        title={t("common.recommendedSetup")}
        items={getTranslatedList(t, `${namespace}.items`, 4)}
      />
    </DashboardPanel>
  );
}

function SettingsChecklist({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 divide-y divide-border/50 rounded-lg border border-border/60">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 px-3 py-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Check className="size-3.5" />
            </span>
            <p className="text-sm leading-6">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSidePanel({
  workspace,
  t,
}: {
  workspace: SettingsWorkspace;
  t: ReturnType<typeof useTranslations<"settings">>;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
      <DashboardPanel>
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t("side.workspace.title")}</h2>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <KeyValue label={t("side.workspace.name")} value={workspace.name} />
          <KeyValue
            label={t("side.workspace.organization")}
            value={workspace.organization.name}
          />
          <KeyValue label={t("side.workspace.plan")} value={workspace.plan} />
          <KeyValue label={t("side.workspace.id")} value={workspace.id} mono />
        </dl>
      </DashboardPanel>

      <DashboardPanel>
        <h2 className="text-sm font-semibold">{t("side.security.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("side.security.description")}
        </p>
      </DashboardPanel>
    </aside>
  );
}

function KeyValue({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={mono ? "mt-1 truncate font-mono text-xs" : "mt-1 truncate"}
      >
        {value}
      </dd>
    </div>
  );
}

function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? copiedLabel : label}
    </Button>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "good" | "warning";
}) {
  const className =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-muted/30 text-muted-foreground";

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

interface SettingsPage {
  title: string;
  description: string;
  href: string;
  statusLabel: string;
  statusTone: "neutral" | "good" | "warning";
  summary: [SettingsSummaryItem, SettingsSummaryItem, SettingsSummaryItem];
}

interface SettingsSummaryItem {
  label: string;
  value: string;
  description: string;
  tone?: "neutral" | "good" | "warning" | "bad";
}

function getSettingsPage(
  kind: SettingsPageKind,
  t: ReturnType<typeof useTranslations<"settings">>,
): SettingsPage {
  return {
    title: t(`pages.${kind}.title`),
    description: t(`pages.${kind}.description`),
    href: getSettingsHref(kind),
    statusLabel: t(`pages.${kind}.status`),
    statusTone: kind === "api-keys" || kind === "sdk" ? "good" : "neutral",
    summary: [
      {
        label: t("summary.workspace"),
        value: "",
        description: t("summary.workspaceDescription"),
      },
      {
        label: t("summary.plan"),
        value: "",
        description: t("summary.planDescription"),
      },
      {
        label: t("summary.security"),
        value: t("summary.securityValue"),
        description: t("summary.securityDescription"),
        tone: "good",
      },
    ],
  };
}

function getSettingsHref(kind: SettingsPageKind) {
  if (kind.startsWith("notification-")) {
    return `/settings/notifications/${kind.replace("notification-", "")}`;
  }

  return `/settings/${kind}`;
}

function getTranslatedList(
  t: ReturnType<typeof useTranslations<"settings">>,
  key: string,
  count: number,
) {
  return Array.from({ length: count }, (_, index) => t(`${key}.${index + 1}`));
}

function getPermissionLabel(
  permission: WorkspaceApiKeyPermission,
  t: ReturnType<typeof useTranslations<"settings">>,
) {
  return t(`apiKeys.permissions.${permission}.label`);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function getClientEndpoint() {
  if (typeof window === "undefined") return "https://api.lynx.run";
  return `${window.location.origin}/api`;
}
