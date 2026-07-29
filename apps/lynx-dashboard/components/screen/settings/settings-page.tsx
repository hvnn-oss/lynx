"use client";

import { requestBinaryContract, requestContract } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import {
  organizationContract,
  profileContract,
  integrationContract,
  workspaceContract,
} from "@repo/contract";
import type {
  DashboardBootstrapResponseDto,
  SlackIntegrationResponseDto,
  TeamInvitationResponseDto,
  TeamInvitationRole,
} from "@repo/dto";
import {
  SLACK_NOTIFICATION_EVENT_TYPE,
  USER_PERMISSIONS,
  type SlackNotificationEventType,
} from "@repo/constants";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  AlertTriangle,
  Bell,
  Check,
  Copy,
  ExternalLink,
  ImageUp,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  Webhook,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

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

type Workspace = DashboardBootstrapResponseDto["workspaces"][number];
type Profile = DashboardBootstrapResponseDto["user"];
type Organization = DashboardBootstrapResponseDto["organizations"][number];
type Member = {
  id: number;
  userId: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
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
type PendingProfileImage = {
  file: File;
  previewUrl: string;
};

export function SettingsPage({ kind }: { kind: SettingsPageKind }) {
  const t = useTranslations("settings");
  const storedUser = useUserStore((state) => state.user);
  const storedOrganizations = useUserStore((state) => state.organizations);
  const storedWorkspaces = useUserStore((state) => state.workspaces);
  const activeOrganizationId = useUserStore(
    (state) => state.activeOrganizationId,
  );
  const setActiveOrganization = useUserStore(
    (state) => state.setActiveOrganization,
  );
  const updateStoredUser = useUserStore((state) => state.updateUser);
  const updateStoredOrganization = useUserStore(
    (state) => state.updateOrganization,
  );
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<
    TeamInvitationResponseDto[]
  >([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const selectedOrganization =
        storedOrganizations.find((item) => item.id === activeOrganizationId) ??
        storedOrganizations[0] ??
        null;
      const selectedWorkspace =
        storedWorkspaces.find(
          (item) => item.orgId === selectedOrganization?.id,
        ) ?? (selectedOrganization ? null : (storedWorkspaces[0] ?? null));
      setWorkspace(selectedWorkspace);
      setProfile(storedUser);
      setOrganization(selectedOrganization);

      if (kind.startsWith("organization") && selectedOrganization) {
        const organizationId = selectedOrganization.id;
        if (kind === "organization-members") {
          const [memberResponse, invitationResponse] = await Promise.all([
            requestContract({
              basePath: organizationContract.basePath,
              endpoint: organizationContract.listMembers,
              params: { organizationId },
            }),
            requestContract({
              basePath: organizationContract.basePath,
              endpoint: organizationContract.listInvitations,
              params: { organizationId },
            }),
          ]);
          setMembers(memberResponse.items);
          setTeamInvitations(invitationResponse.items);
        }
        if (kind === "organization-api-keys") {
          if (selectedWorkspace) {
            const response = await requestContract({
              basePath: workspaceContract.basePath,
              endpoint: workspaceContract.listApiKeys,
              params: { workspaceId: selectedWorkspace.id },
            });
            setApiKeys(response.items);
          } else {
            setApiKeys([]);
          }
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
        key={organization?.id}
        organization={organization}
        organizations={storedOrganizations}
        onSelected={(organizationId) => {
          const selectedOrganization =
            storedOrganizations.find((item) => item.id === organizationId) ??
            null;
          setActiveOrganization(organizationId);
          setOrganization(selectedOrganization);
          setWorkspace(
            storedWorkspaces.find((item) => item.orgId === organizationId) ??
              null,
          );
        }}
        onSaved={(nextOrganization) => {
          setOrganization(nextOrganization);
          updateStoredOrganization(nextOrganization);
        }}
      />
    );
  }
  if (kind === "organization-members") {
    return (
      <OrganizationMembers
        organization={organization}
        members={members}
        invitations={teamInvitations}
        onReload={load}
      />
    );
  }
  if (kind === "organization-integrations") {
    return (
      <OrganizationIntegrations
        workspace={workspace}
        workspaces={storedWorkspaces.filter(
          (item) => item.orgId === organization?.id,
        )}
        onWorkspaceSelected={(workspaceId) =>
          setWorkspace(
            storedWorkspaces.find((item) => item.id === workspaceId) ?? null,
          )
        }
      />
    );
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
    return (
      <PersonalGeneral
        profile={profile}
        onSaved={(nextProfile) => {
          setProfile(nextProfile);
          updateStoredUser(nextProfile);
        }}
      />
    );
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
  organizations,
  onSelected,
  onSaved,
}: {
  organization: Organization | null;
  organizations: Organization[];
  onSelected: (organizationId: string) => void;
  onSaved: (organization: Organization) => void;
}) {
  const t = useTranslations("settings");
  const profileT = useTranslations("profileSettings");
  const [name, setName] = useState(organization?.name ?? "");
  const [status, setStatus] = useState("");
  const { pendingImage, selectImage, clearPendingImage } =
    usePendingProfileImage();
  if (!organization) return <EmptyWorkspace />;
  return (
    <SettingsShell
      title={t("organization.generalTitle")}
      description={t("organization.generalDescription")}
    >
      <SettingsPanel>
        {organizations.length > 1 ? (
          <FormField label={profileT("organizationLabel")}>
            <Select
              value={organization.id}
              onValueChange={(value) => onSelected(value ?? organization.id)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        <ProfileImageEditor
          name={name}
          imageUrl={organization.profileImageUrl}
          previewUrl={pendingImage?.previewUrl ?? null}
          onSelect={selectImage}
        />
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
            let nextOrganization = await requestContract({
              basePath: organizationContract.basePath,
              endpoint: organizationContract.updateProfile,
              params: { organizationId: organization.id },
              request: { name },
            });

            if (pendingImage) {
              const image = await requestBinaryContract({
                basePath: organizationContract.basePath,
                endpoint: organizationContract.uploadProfileImage,
                params: { organizationId: organization.id },
                body: pendingImage.file,
              });
              nextOrganization = {
                ...nextOrganization,
                profileImageUrl: image.profileImageUrl,
              };
            }

            onSaved(nextOrganization);
            clearPendingImage();
            setStatus(t("saved"));
          }}
        />
      </SettingsPanel>
    </SettingsShell>
  );
}

function OrganizationMembers({
  organization,
  members,
  invitations,
  onReload,
}: {
  organization: Organization | null;
  members: Member[];
  invitations: TeamInvitationResponseDto[];
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("settings");
  const inviteT = useTranslations("teamInviteSettings");
  const [isCreating, setIsCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamInvitationRole>(
    USER_PERMISSIONS.MEMBER,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [createdInvitationUrl, setCreatedInvitationUrl] = useState("");

  async function createInvitation() {
    if (!organization) return;
    setIsSubmitting(true);
    setInviteError("");
    try {
      const invitation = await requestContract({
        basePath: organizationContract.basePath,
        endpoint: organizationContract.createInvitation,
        params: { organizationId: organization.id },
        request: { email, role },
      });
      setCreatedInvitationUrl(invitation.invitationUrl);
      setEmail("");
      setRole(USER_PERMISSIONS.MEMBER);
      await onReload();
    } catch (error) {
      setInviteError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SettingsShell
      title={t("organization.membersTitle")}
      description={t("organization.membersDescription")}
      action={
        <Button
          disabled={!organization}
          onClick={() => setIsCreating((value) => !value)}
        >
          <Plus className="size-4" />
          {inviteT("inviteMember")}
        </Button>
      }
    >
      {isCreating ? (
        <SettingsPanel>
          {createdInvitationUrl ? (
            <>
              <p className="text-sm font-medium">{inviteT("linkReady")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {inviteT("linkDescription")}
              </p>
              <div className="mt-4 flex gap-2">
                <Input readOnly value={createdInvitationUrl} />
                <Button
                  variant="outline"
                  size="icon"
                  title={inviteT("copyLink")}
                  onClick={() =>
                    void navigator.clipboard.writeText(createdInvitationUrl)
                  }
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <div className="mt-4 flex justify-end border-t pt-4">
                <Button
                  onClick={() => {
                    setCreatedInvitationUrl("");
                    setIsCreating(false);
                  }}
                >
                  {inviteT("done")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <FormField label={inviteT("email")}>
                  <Input
                    type="email"
                    value={email}
                    placeholder="member@example.com"
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </FormField>
                <FormField label={inviteT("role")}>
                  <Select
                    value={role}
                    onValueChange={(value) =>
                      setRole(
                        value === USER_PERMISSIONS.ADMIN
                          ? USER_PERMISSIONS.ADMIN
                          : value === USER_PERMISSIONS.VIEWER
                            ? USER_PERMISSIONS.VIEWER
                            : USER_PERMISSIONS.MEMBER,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={USER_PERMISSIONS.ADMIN}>
                        {inviteT("roles.ADMIN")}
                      </SelectItem>
                      <SelectItem value={USER_PERMISSIONS.MEMBER}>
                        {inviteT("roles.MEMBER")}
                      </SelectItem>
                      <SelectItem value={USER_PERMISSIONS.VIEWER}>
                        {inviteT("roles.VIEWER")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              {inviteError ? (
                <p className="text-sm text-destructive">{inviteError}</p>
              ) : null}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  {inviteT("cancel")}
                </Button>
                <Button
                  disabled={!email || isSubmitting}
                  onClick={() => void createInvitation()}
                >
                  {isSubmitting ? inviteT("sending") : inviteT("send")}
                </Button>
              </div>
            </>
          )}
        </SettingsPanel>
      ) : null}

      <SettingsPanel className="divide-y p-0">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-4 px-4 py-3">
            <Avatar>
              {member.profileImageUrl ? (
                <AvatarImage src={member.profileImageUrl} alt={member.name} />
              ) : null}
              <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
            </Avatar>
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

      {invitations.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-medium">
            {inviteT("invitationHistory")}
          </h2>
          <SettingsPanel className="divide-y p-0">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {invitation.email}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {inviteT("expires", {
                      date: new Date(invitation.expiresAt).toLocaleString(),
                    })}
                  </div>
                </div>
                <Badge>{inviteT(`roles.${invitation.role}`)}</Badge>
                <Badge>{inviteT(`status.${invitation.status}`)}</Badge>
                {invitation.status === "PENDING" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title={inviteT("revoke")}
                    onClick={async () => {
                      if (!organization) return;
                      await requestContract({
                        basePath: organizationContract.basePath,
                        endpoint: organizationContract.revokeInvitation,
                        params: {
                          organizationId: organization.id,
                          invitationId: invitation.id,
                        },
                      });
                      await onReload();
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            ))}
          </SettingsPanel>
        </section>
      ) : null}
    </SettingsShell>
  );
}

function OrganizationIntegrations({
  workspace,
  workspaces,
  onWorkspaceSelected,
}: {
  workspace: Workspace | null;
  workspaces: Workspace[];
  onWorkspaceSelected: (workspaceId: string) => void;
}) {
  const t = useTranslations("settings");
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id ?? "";
  const slack = useQuery({
    queryKey: ["settings", "integrations", "slack", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      requestContract({
        basePath: integrationContract.basePath,
        endpoint: integrationContract.getSlack,
        params: { workspaceId },
      }),
    refetchInterval: (query) =>
      query.state.data?.deliveries.some((delivery) =>
        ["PENDING", "PROCESSING", "RETRY_SCHEDULED"].includes(delivery.status),
      )
        ? 2_000
        : false,
  });

  if (!workspace) return <EmptyWorkspace />;

  async function updateSlackCache(next: SlackIntegrationResponseDto) {
    queryClient.setQueryData(
      ["settings", "integrations", "slack", workspaceId],
      next,
    );
  }

  return (
    <SettingsShell
      title={t("organization.integrationsTitle")}
      description={t("organization.integrationsDescription")}
    >
      {workspaces.length > 1 ? (
        <SettingsPanel>
          <FormField label={t("organization.integrationWorkspace")}>
            <Select
              value={workspace.id}
              onValueChange={(value) =>
                onWorkspaceSelected(value ?? workspace.id)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </SettingsPanel>
      ) : null}

      {slack.isPending ? (
        <div className="h-48 animate-pulse rounded-lg border bg-muted/40" />
      ) : slack.isError ? (
        <SettingsPanel className="flex items-center justify-between gap-4">
          <span className="text-sm text-destructive">
            {getErrorMessage(slack.error)}
          </span>
          <Button variant="outline" onClick={() => void slack.refetch()}>
            <RefreshCw className="size-4" />
            {t("retry")}
          </Button>
        </SettingsPanel>
      ) : slack.data ? (
        <SlackIntegrationEditor
          key={workspaceId}
          workspaceId={workspaceId}
          integration={slack.data}
          onChanged={updateSlackCache}
          onReload={() => slack.refetch()}
        />
      ) : null}

      <SettingsPanel className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center rounded-lg border">
          <Webhook className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{t("organization.webhook")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("organization.webhookDescription")}
          </div>
        </div>
        <Badge>{t("organization.policyWebhook")}</Badge>
      </SettingsPanel>

      <SettingsPanel className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center rounded-lg border">
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">
            {t("organization.pagerduty")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("organization.pagerdutyDescription")}
          </div>
        </div>
        <Badge>{t("organization.comingSoon")}</Badge>
      </SettingsPanel>
    </SettingsShell>
  );
}

function SlackIntegrationEditor({
  workspaceId,
  integration,
  onChanged,
  onReload,
}: {
  workspaceId: string;
  integration: SlackIntegrationResponseDto;
  onChanged: (integration: SlackIntegrationResponseDto) => Promise<void>;
  onReload: () => Promise<unknown>;
}) {
  const t = useTranslations("settings");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [displayName, setDisplayName] = useState(integration.displayName ?? "");
  const [isEnabled, setIsEnabled] = useState(integration.isEnabled);
  const [eventTypes, setEventTypes] = useState<SlackNotificationEventType[]>(
    integration.eventTypes,
  );
  const [pendingAction, setPendingAction] = useState<
    "save" | "test" | "delete" | string | null
  >(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function toggleEvent(type: SlackNotificationEventType, checked: boolean) {
    setEventTypes((current) =>
      checked
        ? [...new Set([...current, type])]
        : current.filter((item) => item !== type),
    );
  }

  async function runAction(
    action: NonNullable<typeof pendingAction>,
    operation: () => Promise<void>,
  ) {
    setPendingAction(action);
    setError("");
    setStatus("");
    try {
      await operation();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <SettingsPanel>
      <div className="flex items-start gap-4 border-b pb-4">
        <div className="flex size-10 items-center justify-center rounded-lg border">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{t("organization.slack")}</h2>
            <Badge>
              {integration.isConfigured
                ? integration.isEnabled
                  ? t("organization.connected")
                  : t("organization.disabled")
                : t("organization.notConnected")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("organization.slackDescription")}
          </p>
          {integration.destination ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {integration.destination}
            </p>
          ) : null}
        </div>
        <Button variant="outline" asChild>
          <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            {t("organization.openSlackApps")}
          </a>
        </Button>
      </div>

      <div className="grid gap-x-4 pt-4 sm:grid-cols-2">
        <FormField label={t("organization.slackWebhookUrl")}>
          <Input
            type="password"
            autoComplete="off"
            value={webhookUrl}
            placeholder={
              integration.isConfigured
                ? t("organization.slackWebhookPreserved")
                : "https://hooks.slack.com/services/..."
            }
            onChange={(event) => setWebhookUrl(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("organization.slackWebhookHint")}
          </p>
        </FormField>
        <FormField label={t("organization.slackDisplayName")}>
          <Input
            value={displayName}
            placeholder="#lynx-alerts"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </FormField>
      </div>

      <div className="border-t py-4">
        <div className="mb-3 text-sm font-medium">
          {t("organization.slackNotifications")}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              [
                SLACK_NOTIFICATION_EVENT_TYPE.FIREWALL_BLOCKED,
                t("organization.firewallBlocked"),
              ],
              [
                SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_REQUESTED,
                t("organization.approvalRequested"),
              ],
              [
                SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_DECIDED,
                t("organization.approvalDecided"),
              ],
            ] as Array<[SlackNotificationEventType, string]>
          ).map(([type, label]) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
            >
              <input
                type="checkbox"
                className="size-4 accent-foreground"
                checked={eventTypes.includes(type)}
                onChange={(event) => toggleEvent(type, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="border-t py-4">
        <ToggleRow
          title={t("organization.slackEnabled")}
          checked={isEnabled}
          onChange={setIsEnabled}
        />
        <p className="px-4 text-xs text-muted-foreground">
          {t("organization.slackEnabledDescription")}
        </p>
      </div>

      <div className="border-t pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">
              {t("organization.recentSlackDeliveries")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("organization.recentSlackDeliveriesDescription")}
            </p>
          </div>
          {integration.isConfigured ? (
            <Button
              variant="outline"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("test", async () => {
                  const result = await requestContract({
                    basePath: integrationContract.basePath,
                    endpoint: integrationContract.testSlack,
                    params: { workspaceId },
                  });
                  await onChanged({
                    ...integration,
                    deliveries: [
                      result.delivery,
                      ...integration.deliveries,
                    ].slice(0, 10),
                  });
                  setStatus(t("organization.slackTestQueued"));
                })
              }
            >
              <Send className="size-4" />
              {pendingAction === "test"
                ? t("organization.testing")
                : t("organization.sendTest")}
            </Button>
          ) : null}
        </div>

        {integration.deliveries.length ? (
          <div className="divide-y rounded-md border">
            {integration.deliveries.slice(0, 5).map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {delivery.eventType}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(delivery.createdAt).toLocaleString()} ·{" "}
                    {t("organization.deliveryAttempt", {
                      current: delivery.attemptCount,
                      max: delivery.maxAttempts,
                    })}
                    {delivery.responseStatus
                      ? ` · HTTP ${delivery.responseStatus}`
                      : ""}
                  </div>
                  {delivery.lastError ? (
                    <p className="mt-1 truncate text-[11px] text-destructive">
                      {delivery.lastError}
                    </p>
                  ) : null}
                </div>
                <Badge>{delivery.status}</Badge>
                {["FAILED", "RETRY_SCHEDULED"].includes(delivery.status) ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    title={t("organization.retryDelivery")}
                    disabled={pendingAction !== null}
                    onClick={() =>
                      void runAction(delivery.id, async () => {
                        await requestContract({
                          basePath: integrationContract.basePath,
                          endpoint: integrationContract.retrySlackDelivery,
                          params: {
                            workspaceId,
                            deliveryId: delivery.id,
                          },
                        });
                        await onReload();
                      })
                    }
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            {t("organization.noSlackDeliveries")}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span
          className={`text-xs ${error ? "text-destructive" : "text-emerald-700"}`}
        >
          {error || status}
        </span>
        <div className="flex gap-2">
          {integration.isConfigured ? (
            <Button
              variant="outline"
              disabled={pendingAction !== null}
              onClick={() => {
                if (
                  !window.confirm(t("organization.disconnectSlackConfirmation"))
                ) {
                  return;
                }
                void runAction("delete", async () => {
                  await requestContract({
                    basePath: integrationContract.basePath,
                    endpoint: integrationContract.deleteSlack,
                    params: { workspaceId },
                  });
                  await onReload();
                });
              }}
            >
              <Trash2 className="size-4" />
              {t("organization.disconnect")}
            </Button>
          ) : null}
          <Button
            disabled={
              pendingAction !== null ||
              (!integration.isConfigured && !webhookUrl.trim())
            }
            onClick={() =>
              void runAction("save", async () => {
                const next = await requestContract({
                  basePath: integrationContract.basePath,
                  endpoint: integrationContract.updateSlack,
                  params: { workspaceId },
                  request: {
                    ...(webhookUrl.trim()
                      ? { webhookUrl: webhookUrl.trim() }
                      : {}),
                    displayName: displayName.trim() || null,
                    isEnabled,
                    eventTypes,
                  },
                });
                setWebhookUrl("");
                await onChanged(next);
                setStatus(t("saved"));
              })
            }
          >
            {pendingAction === "save" ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </SettingsPanel>
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
            <Select
              value={environment}
              onValueChange={(value) =>
                setEnvironment(
                  workspaceContract.createApiKey.request.shape.environment.parse(
                    value,
                  ),
                )
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
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
  const { pendingImage, selectImage, clearPendingImage } =
    usePendingProfileImage();
  if (!profile) return null;
  return (
    <SettingsShell
      title={t("personal.generalTitle")}
      description={t("personal.generalDescription")}
    >
      <SettingsPanel>
        <ProfileImageEditor
          name={name}
          imageUrl={profile.profileImageUrl}
          previewUrl={pendingImage?.previewUrl ?? null}
          onSelect={selectImage}
        />
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
            let nextProfile = await requestContract({
              basePath: profileContract.basePath,
              endpoint: profileContract.update,
              request: { name },
            });

            if (pendingImage) {
              const image = await requestBinaryContract({
                basePath: profileContract.basePath,
                endpoint: profileContract.uploadImage,
                body: pendingImage.file,
              });
              nextProfile = {
                ...nextProfile,
                profileImageUrl: image.profileImageUrl,
              };
            }

            onSaved(nextProfile);
            clearPendingImage();
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

function ProfileImageEditor({
  name,
  imageUrl,
  previewUrl,
  onSelect,
}: {
  name: string;
  imageUrl: string | null;
  previewUrl: string | null;
  onSelect: (file: File) => void;
}) {
  const t = useTranslations("profileSettings");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    onSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const displayedImageUrl = previewUrl ?? imageUrl;

  return (
    <div className="mb-5 flex items-center gap-4 border-b pb-5">
      <Avatar className="size-16">
        {displayedImageUrl ? (
          <AvatarImage src={displayedImageUrl} alt={name} />
        ) : null}
        <AvatarFallback className="text-base">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{t("imageLabel")}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("imageDescription")}
        </p>
        {previewUrl ? (
          <p className="mt-1 text-xs text-amber-700">{t("previewPending")}</p>
        ) : null}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageUp className="size-4" />
        {t("changeImage")}
      </Button>
    </div>
  );
}

/** 선택한 이미지는 저장 전까지 브라우저 메모리에서만 미리보기로 유지합니다. */
function usePendingProfileImage() {
  const [pendingImage, setPendingImage] = useState<PendingProfileImage | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage]);

  function selectImage(file: File) {
    setPendingImage({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function clearPendingImage() {
    setPendingImage(null);
  }

  return { pendingImage, selectImage, clearPendingImage };
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

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "LY"
  );
}
