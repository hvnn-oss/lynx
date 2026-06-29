"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, KeyRound, RotateCcw, Save } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  DashboardMetricCard,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import type { WorkspaceDetailDto, WorkspacePlanValue } from "@repo/dto";
import {
  useRotateWorkspaceApiKeyMutation,
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

const defaultWorkspacePlans: WorkspacePlanValue[] = [
  "FREE",
  "PRO",
  "ENTERPRISE",
];

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
  const [plan, setPlan] = useState<WorkspacePlanValue>(workspace.plan);
  const updateMutation = useUpdateWorkspaceMutation(workspace.id);
  const planOptions = useMemo(() => {
    return Array.from(new Set([...defaultWorkspacePlans, workspace.plan]));
  }, [workspace.plan]);

  useEffect(() => {
    setName(workspace.name);
    setPlan(workspace.plan);
  }, [workspace.name, workspace.plan]);

  const hasChanges = name.trim() !== workspace.name || plan !== workspace.plan;

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
          <select
            id="workspace-plan"
            value={plan}
            onChange={(event) =>
              setPlan(event.target.value as WorkspacePlanValue)
            }
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {planOptions.map((value) => (
              <option key={value} value={value}>
                {getPlanLabel(value, t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          disabled={!hasChanges || updateMutation.isPending}
          onClick={() =>
            updateMutation.mutate({
              name: name.trim(),
              plan,
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
  const rotateMutation = useRotateWorkspaceApiKeyMutation(workspace.id);
  const apiKey = rotateMutation.data?.apiKey ?? workspace.apiKey ?? "";

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">
          {t("apiKeys.current.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("apiKeys.current.description")}
        </p>
      </div>

      <div className="mt-5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {t("apiKeys.current.label")}
            </p>
            <p className="mt-1 truncate font-mono text-sm">
              {maskApiKey(apiKey)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <CopyButton
              value={apiKey}
              label={t("common.copy")}
              copiedLabel={t("common.copied")}
            />
            <Button
              variant="outline"
              disabled={rotateMutation.isPending}
              onClick={() => rotateMutation.mutate()}
            >
              <RotateCcw />
              {rotateMutation.isPending
                ? t("apiKeys.current.rotating")
                : t("apiKeys.current.rotate")}
            </Button>
          </div>
        </div>
      </div>

      <SettingsChecklist
        title={t("apiKeys.safety.title")}
        items={getTranslatedList(t, "apiKeys.safety.items", 3)}
      />
    </DashboardPanel>
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

function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 12) return apiKey;
  return `${apiKey.slice(0, 10)}...${apiKey.slice(-6)}`;
}

function getClientEndpoint() {
  if (typeof window === "undefined") return "https://api.lynx.run";
  return `${window.location.origin}/api`;
}
