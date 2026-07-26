"use client";

import { requestContract } from "@/lib/api";
import {
  organizationContract,
  profileContract,
  workspaceContract,
} from "@repo/contract";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  AlertTriangle,
  Bell,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export type SettingsPageKind =
  | "organization-general"
  | "organization-members"
  | "organization-integrations"
  | "organization-api-keys"
  | "organization-security"
  | "personal-general"
  | "personal-security"
  | "personal-preferences"
  | "openapi-general"
  | "openapi-ingestion"
  | "openapi-runtime-config";

type Workspace = { id: string; name: string; orgId: string };
type Profile = {
  id: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
};
type Organization = {
  id: string;
  name: string;
  profileImageUrl: string | null;
  role: string;
};
type Member = {
  id: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
};
type ApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  kind: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

export function SettingsPage({ kind }: { kind: SettingsPageKind }) {
  const t = useTranslations("settings");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const workspaceResponse = await requestContract({
        basePath: workspaceContract.basePath,
        endpoint: workspaceContract.list,
      });
      const selectedWorkspace = workspaceResponse.items[0] ?? null;
      setWorkspace(selectedWorkspace);

      if (kind.startsWith("personal")) {
        setProfile(
          await requestContract({
            basePath: profileContract.basePath,
            endpoint: profileContract.get,
          }),
        );
      }
      if (kind.startsWith("organization") && selectedWorkspace) {
        const organizationId = selectedWorkspace.orgId;
        setOrganization(
          await requestContract({
            basePath: organizationContract.basePath,
            endpoint: organizationContract.getProfile,
            params: { organizationId },
          }),
        );
        if (kind === "organization-members") {
          const response = await requestContract({
            basePath: organizationContract.basePath,
            endpoint: organizationContract.listMembers,
            params: { organizationId },
          });
          setMembers(response.items);
        }
        if (kind === "organization-api-keys") {
          const response = await requestContract({
            basePath: workspaceContract.basePath,
            endpoint: workspaceContract.listApiKeys,
            params: { workspaceId: selectedWorkspace.id },
          });
          setApiKeys(response.items);
        }
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Data loading is intentionally keyed to the selected settings route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // `load` is recreated with the route-specific data requirements above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (isLoading) {
    return (
      <SettingsShell title={t("title")} description={t("loading")}>
        <div className="h-40 animate-pulse rounded-lg border bg-muted/40" />
      </SettingsShell>
    );
  }
  if (error) {
    return (
      <SettingsShell title={t("title")} description={error}>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          {t("retry")}
        </Button>
      </SettingsShell>
    );
  }

  if (kind === "organization-general") {
    return (
      <OrganizationGeneral
        organization={organization}
        onSaved={setOrganization}
      />
    );
  }
  if (kind === "organization-members") {
    return <OrganizationMembers members={members} />;
  }
  if (kind === "organization-integrations") {
    return <OrganizationIntegrations />;
  }
  if (kind === "organization-api-keys") {
    return (
      <OrganizationApiKeys
        workspace={workspace}
        apiKeys={apiKeys}
        onReload={load}
      />
    );
  }
  if (kind === "organization-security") {
    return <OrganizationSecurity organization={organization} />;
  }
  if (kind === "personal-general") {
    return <PersonalGeneral profile={profile} onSaved={setProfile} />;
  }
  if (kind === "personal-security") return <PersonalSecurity />;
  if (kind === "personal-preferences") return <PersonalPreferences />;
  if (kind === "openapi-ingestion")
    return <OpenApiIngestion workspace={workspace} />;
  if (kind === "openapi-runtime-config") return <OpenApiRuntimeConfig />;
  return <OpenApiGeneral />;
}

function OrganizationGeneral({
  organization,
  onSaved,
}: {
  organization: Organization | null;
  onSaved: (organization: Organization) => void;
}) {
  const t = useTranslations("settings");
  const [name, setName] = useState(organization?.name ?? "");
  const [status, setStatus] = useState("");
  if (!organization) return <EmptyWorkspace />;
  return (
    <SettingsShell
      title={t("organization.generalTitle")}
      description={t("organization.generalDescription")}
    >
      <SettingsPanel>
        <FormField label={t("organization.name")}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <ReadOnly label={t("organization.id")} value={organization.id} />
        <ReadOnly label={t("organization.role")} value={organization.role} />
        <SaveRow
          status={status}
          onSave={async () => {
            const response = await requestContract({
              basePath: organizationContract.basePath,
              endpoint: organizationContract.updateProfile,
              params: { organizationId: organization.id },
              request: { name },
            });
            onSaved(response);
            setStatus(t("saved"));
          }}
        />
      </SettingsPanel>
    </SettingsShell>
  );
}

function OrganizationMembers({ members }: { members: Member[] }) {
  const t = useTranslations("settings");
  return (
    <SettingsShell
      title={t("organization.membersTitle")}
      description={t("organization.membersDescription")}
      action={
        <Button disabled>
          <Plus className="size-4" />
          {t("organization.member")}
        </Button>
      }
    >
      <SettingsPanel className="divide-y p-0">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{member.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {member.email}
              </div>
            </div>
            <Badge>{member.role}</Badge>
            <div className="hidden text-xs text-muted-foreground sm:block">
              {new Date(member.joinedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </SettingsPanel>
    </SettingsShell>
  );
}

function OrganizationIntegrations() {
  const t = useTranslations("settings");
  const integrations = [
    ["Slack", t("organization.slackDescription"), Bell],
    ["Webhook", t("organization.webhookDescription"), Webhook],
    ["PagerDuty", t("organization.pagerdutyDescription"), AlertTriangle],
  ] as const;
  return (
    <SettingsShell
      title={t("organization.integrationsTitle")}
      description={t("organization.integrationsDescription")}
    >
      <div className="grid gap-3">
        {integrations.map(([name, description, Icon]) => (
          <SettingsPanel key={name} className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg border">
              <Icon className="size-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {description}
              </div>
            </div>
            <Badge>{t("organization.notConnected")}</Badge>
            <Button variant="outline" disabled>
              {t("organization.configure")}
            </Button>
          </SettingsPanel>
        ))}
      </div>
    </SettingsShell>
  );
}

function OrganizationApiKeys({
  workspace,
  apiKeys,
  onReload,
}: {
  workspace: Workspace | null;
  apiKeys: ApiKeyItem[];
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("settings");
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("SDK development");
  const [environment, setEnvironment] = useState<
    "development" | "staging" | "production"
  >("development");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  if (!workspace) return <EmptyWorkspace />;
  const workspaceId = workspace.id;

  async function createKey() {
    const response = await requestContract({
      basePath: workspaceContract.basePath,
      endpoint: workspaceContract.createApiKey,
      params: { workspaceId },
      request: {
        name,
        environment,
        expirePeriodDays: null,
        kind: "SDK",
        scopes: ["events:write", "config:read", "policies:read"],
      },
    });
    setCreatedKey(response.key);
    setIsCreating(false);
  }

  return (
    <SettingsShell
      title={t("organization.apiKeysTitle")}
      description={t("organization.apiKeysDescription")}
      action={
        <Button onClick={() => setIsCreating((value) => !value)}>
          <Plus className="size-4" />
          {t("organization.createKey")}
        </Button>
      }
    >
      {isCreating ? (
        <SettingsPanel className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("organization.keyName")}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField label={t("organization.environment")}>
            <select
              value={environment}
              onChange={(event) =>
                setEnvironment(
                  workspaceContract.createApiKey.request.shape.environment.parse(
                    event.target.value,
                  ),
                )
              }
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => void createKey()}>
              {t("organization.createKey")}
            </Button>
          </div>
        </SettingsPanel>
      ) : null}
      {createdKey ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-medium text-amber-900">
            {t("organization.keyWarning")}
          </div>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded border bg-white p-2 text-xs">
              {createdKey}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void navigator.clipboard.writeText(createdKey)}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              onClick={() => {
                setCreatedKey(null);
                void onReload();
              }}
            >
              <Check className="size-4" />
              {t("organization.done")}
            </Button>
          </div>
        </div>
      ) : null}
      <SettingsPanel className="divide-y p-0">
        {apiKeys.map((key) => (
          <div key={key.id} className="flex items-center gap-4 px-4 py-3">
            <KeyRound className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{key.name}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {key.prefix}••••
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {key.scopes.map((scope) => (
                  <Badge key={scope}>{scope}</Badge>
                ))}
              </div>
            </div>
            <Badge>
              {key.revokedAt
                ? t("organization.revoked")
                : t("organization.active")}
            </Badge>
            {!key.revokedAt ? (
              <Button
                variant="ghost"
                size="icon"
                title={t("organization.revoke")}
                onClick={async () => {
                  await requestContract({
                    basePath: workspaceContract.basePath,
                    endpoint: workspaceContract.revokeApiKey,
                    params: { workspaceId, apiKeyId: key.id },
                  });
                  await onReload();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                title={t("organization.deletePermanently")}
                onClick={async () => {
                  if (!window.confirm(t("organization.deleteConfirmation"))) {
                    return;
                  }
                  await requestContract({
                    basePath: workspaceContract.basePath,
                    endpoint: workspaceContract.deleteApiKey,
                    params: { workspaceId, apiKeyId: key.id },
                  });
                  await onReload();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </SettingsPanel>
    </SettingsShell>
  );
}

function OrganizationSecurity({
  organization,
}: {
  organization: Organization | null;
}) {
  const t = useTranslations("settings");
  return (
    <SettingsShell
      title={t("organization.securityTitle")}
      description={t("organization.securityDescription")}
    >
      <SettingsPanel className="divide-y p-0">
        <SettingRow
          icon={ShieldCheck}
          title={t("organization.sso")}
          description={t("organization.ssoDescription")}
          value={t("organization.comingSoon")}
        />
        <SettingRow
          icon={LockKeyhole}
          title={t("organization.enforceSso")}
          description={organization?.role ?? ""}
          value={t("organization.comingSoon")}
        />
        <SettingRow
          icon={Users}
          title={t("organization.sessionPolicy")}
          description="24 hours · Refresh token rotation"
          value={t("organization.comingSoon")}
        />
      </SettingsPanel>
    </SettingsShell>
  );
}

function PersonalGeneral({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
}) {
  const t = useTranslations("settings");
  const [name, setName] = useState(profile?.name ?? "");
  const [status, setStatus] = useState("");
  if (!profile) return null;
  return (
    <SettingsShell
      title={t("personal.generalTitle")}
      description={t("personal.generalDescription")}
    >
      <SettingsPanel>
        <FormField label={t("personal.name")}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <ReadOnly label={t("personal.email")} value={profile.email} />
        <ReadOnly label={t("personal.userId")} value={profile.id} />
        <SaveRow
          status={status}
          onSave={async () => {
            const response = await requestContract({
              basePath: profileContract.basePath,
              endpoint: profileContract.update,
              request: { name },
            });
            onSaved(response);
            setStatus(t("saved"));
          }}
        />
      </SettingsPanel>
    </SettingsShell>
  );
}

function PersonalSecurity() {
  const t = useTranslations("settings");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  return (
    <SettingsShell
      title={t("personal.securityTitle")}
      description={t("personal.securityDescription")}
    >
      <SettingsPanel>
        <FormField label={t("personal.currentPassword")}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </FormField>
        <FormField label={t("personal.newPassword")}>
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </FormField>
        <FormField label={t("personal.confirmPassword")}>
          <Input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          {t("personal.passwordHint")}
        </p>
        <SaveRow
          label={t("personal.changePassword")}
          status={status}
          disabled={newPassword.length < 12 || newPassword !== confirmation}
          onSave={async () => {
            await requestContract({
              basePath: profileContract.basePath,
              endpoint: profileContract.changePassword,
              request: {
                currentPassword,
                newPassword,
              },
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmation("");
            setStatus(t("saved"));
          }}
        />
      </SettingsPanel>
    </SettingsShell>
  );
}

function PersonalPreferences() {
  const t = useTranslations("settings");
  const [digest, setDigest] = useStoredBoolean("lynx-weekly-digest", true);
  const [issues, setIssues] = useStoredBoolean("lynx-issue-alerts", true);
  return (
    <SettingsShell
      title={t("personal.preferencesTitle")}
      description={t("personal.preferencesDescription")}
    >
      <SettingsPanel className="divide-y p-0">
        <ToggleRow
          title={t("personal.emailDigest")}
          checked={digest}
          onChange={setDigest}
        />
        <ToggleRow
          title={t("personal.issueNotifications")}
          checked={issues}
          onChange={setIssues}
        />
        <SettingRow
          icon={Bell}
          title={t("personal.language")}
          description="한국어"
          value="ko"
        />
        <SettingRow
          icon={RefreshCw}
          title={t("personal.timezone")}
          description="Asia/Seoul"
          value="UTC+09:00"
        />
      </SettingsPanel>
      <p className="text-xs text-muted-foreground">
        {t("personal.browserOnly")}
      </p>
    </SettingsShell>
  );
}

function OpenApiGeneral() {
  const t = useTranslations("settings");
  return (
    <SettingsShell
      title={t("openapi.generalTitle")}
      description={t("openapi.generalDescription")}
    >
      <SettingsPanel>
        <SettingRow
          icon={ExternalLink}
          title={t("openapi.schema")}
          description={t("openapi.schemaDescription")}
          value="OpenAPI 3.0.3"
        />
        <ReadOnly label={t("openapi.baseUrl")} value="/api/openapi/v1" />
        <ReadOnly
          label={t("openapi.authentication")}
          value={t("openapi.authenticationValue")}
        />
        <Button variant="outline" asChild>
          <a href="/api/openapi.json" target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            {t("openapi.openSchema")}
          </a>
        </Button>
      </SettingsPanel>
    </SettingsShell>
  );
}

function OpenApiIngestion({ workspace }: { workspace: Workspace | null }) {
  const t = useTranslations("settings");
  return (
    <SettingsShell
      title={t("openapi.ingestionTitle")}
      description={t("openapi.ingestionDescription")}
    >
      <SettingsPanel>
        <ReadOnly
          label={t("openapi.batchEndpoint")}
          value="/openapi/v1/events/batch"
        />
        <ReadOnly label={t("openapi.requiredScope")} value="events:write" />
        <ReadOnly label={t("openapi.recommendedMode")} value="smart" />
        <ReadOnly label="Workspace ID" value={workspace?.id ?? "—"} />
      </SettingsPanel>
    </SettingsShell>
  );
}

function OpenApiRuntimeConfig() {
  const t = useTranslations("settings");
  return (
    <SettingsShell
      title={t("openapi.runtimeTitle")}
      description={t("openapi.runtimeDescription")}
    >
      <SettingsPanel>
        <ReadOnly
          label={t("openapi.runtimeEndpoint")}
          value="/openapi/v1/runtime-config"
        />
        <ReadOnly
          label={t("openapi.requiredScope")}
          value="config:read, policies:read"
        />
        <ReadOnly label={t("openapi.refresh")} value="60 seconds" />
        <ReadOnly label={t("openapi.cache")} value={t("openapi.failOpen")} />
      </SettingsPanel>
    </SettingsShell>
  );
}

function SettingsShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl p-6 lg:p-10">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </header>
      <div className="space-y-4">{children}</div>
    </main>
  );
}

function SettingsPanel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border bg-background p-4 ${className}`}>
      {children}
    </section>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-sm">{value}</div>
    </div>
  );
}

function SaveRow({
  onSave,
  status,
  label,
  disabled,
}: {
  onSave: () => Promise<void>;
  status: string;
  label?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("settings");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  return (
    <div className="flex items-center justify-between border-t pt-4">
      <span
        className={`text-xs ${saveError ? "text-destructive" : "text-emerald-700"}`}
      >
        {saveError || status}
      </span>
      <Button
        disabled={saving || disabled}
        onClick={() => {
          setSaving(true);
          setSaveError("");
          void onSave()
            .catch((error) => setSaveError(getErrorMessage(error)))
            .finally(() => setSaving(false));
        }}
      >
        {saving ? t("saving") : (label ?? t("save"))}
      </Button>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  value,
}: {
  icon: typeof Check;
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4">
      <Icon className="size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function ToggleRow({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between p-4">
      <span className="text-sm font-medium">{title}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-foreground"
      />
    </label>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

function EmptyWorkspace() {
  const t = useTranslations("settings");
  return (
    <SettingsShell title={t("title")} description={t("noWorkspace")}>
      <div />
    </SettingsShell>
  );
}

function useStoredBoolean(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return fallback;
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  });
  return [
    value,
    (next: boolean) => {
      setValue(next);
      window.localStorage.setItem(key, String(next));
    },
  ] as const;
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    if (data.message) return data.message;
  }
  return error instanceof Error ? error.message : "Request failed.";
}
