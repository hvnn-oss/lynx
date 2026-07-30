import type {
  AdminOverview,
  AdminApiKey,
  AdminApiKeyList,
  AdminPlan,
  AdminUserDetail,
  AdminUserList,
  AccessInvitation,
  AccessInvitationList,
  AuditLogDetail,
  AuditLogList,
  OrganizationDetail,
  OrganizationList,
  OpenApiUsage,
  PilotParticipant,
  PilotParticipantList,
  PilotParticipantStatus,
  PlanInput,
} from "./admin-types";

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await parseResponse<{ access_token: string }>(response);
  accessToken = result.access_token;
  await getAdminOverview();
}

export async function logoutAdmin(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: "{}",
  }).catch(() => undefined);
  accessToken = null;
}

export function getAdminOverview(): Promise<AdminOverview> {
  return adminRequest("/admin/overview");
}

export function listAuditLogs(query: Record<string, string | undefined>) {
  return adminRequest<AuditLogList>(`/admin/audit-logs${toQuery(query)}`);
}

export function getAuditLog(auditLogId: string) {
  return adminRequest<AuditLogDetail>(
    `/admin/audit-logs/${encodeURIComponent(auditLogId)}`,
  );
}

export function listAdminApiKeys(
  query: Record<string, string | undefined>,
): Promise<AdminApiKeyList> {
  return adminRequest(`/admin/api-keys${toQuery(query)}`);
}

export function getOpenApiUsage(
  query: Record<string, string | undefined>,
): Promise<OpenApiUsage> {
  return adminRequest(`/admin/openapi-usage${toQuery(query)}`);
}

export function revokeAdminApiKey(apiKeyId: string): Promise<AdminApiKey> {
  return adminRequest(
    `/admin/api-keys/${encodeURIComponent(apiKeyId)}/revoke`,
    { method: "PATCH" },
  );
}

export function listOrganizations(query: Record<string, string | undefined>) {
  return adminRequest<OrganizationList>(
    `/admin/organizations${toQuery(query)}`,
  );
}

export function getOrganization(organizationId: string) {
  return adminRequest<OrganizationDetail>(
    `/admin/organizations/${encodeURIComponent(organizationId)}`,
  );
}

export function updateOrganizationPlan(organizationId: string, planId: string) {
  return adminRequest<OrganizationDetail>(
    `/admin/organizations/${encodeURIComponent(organizationId)}/plan`,
    {
      method: "PATCH",
      body: JSON.stringify({ planId }),
    },
  );
}

export function listUsers(
  query: Record<string, string | undefined>,
): Promise<AdminUserList> {
  return adminRequest(`/admin/users${toQuery(query)}`);
}

export function getUser(userId: string): Promise<AdminUserDetail> {
  return adminRequest(`/admin/users/${encodeURIComponent(userId)}`);
}

export function updateUserAdminAccess(
  userId: string,
  isAdmin: boolean,
): Promise<AdminUserDetail> {
  return adminRequest(
    `/admin/users/${encodeURIComponent(userId)}/admin-access`,
    {
      method: "PATCH",
      body: JSON.stringify({ isAdmin }),
    },
  );
}

export function createPilotInvitation(
  email: string,
  expiresInHours: number,
): Promise<AccessInvitation> {
  return adminRequest("/access/invitations", {
    method: "POST",
    body: JSON.stringify({ email, expiresInHours }),
  });
}

export function listPilotInvitations(
  query: Record<string, string | undefined>,
): Promise<AccessInvitationList> {
  return adminRequest(`/access/invitations${toQuery(query)}`);
}

export function revokePilotInvitation(
  invitationId: string,
): Promise<{ success: true }> {
  return adminRequest(
    `/access/invitations/${encodeURIComponent(invitationId)}`,
    { method: "DELETE" },
  );
}

export function listPilotParticipants(
  query: Record<string, string | undefined>,
): Promise<PilotParticipantList> {
  return adminRequest(`/admin/pilot/participants${toQuery(query)}`);
}

export function updatePilotParticipant(
  participantId: string,
  status: Exclude<PilotParticipantStatus, "EXPIRED">,
): Promise<PilotParticipant> {
  return adminRequest(
    `/admin/pilot/participants/${encodeURIComponent(participantId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(status === "ACTIVE" ? { expiresAt: null } : {}),
      }),
    },
  );
}

export async function listPlans(): Promise<AdminPlan[]> {
  const result = await adminRequest<{ items: AdminPlan[] }>("/admin/plans");
  return result.items;
}

export function createPlan(input: PlanInput): Promise<AdminPlan> {
  return adminRequest("/admin/plans", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePlan(
  planId: string,
  input: Partial<PlanInput>,
): Promise<AdminPlan> {
  return adminRequest(`/admin/plans/${encodeURIComponent(planId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
  canRetry = true,
): Promise<T> {
  if (!accessToken) await refreshAccessToken();
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 && canRetry) {
    accessToken = null;
    await refreshAccessToken();
    return adminRequest<T>(path, init, false);
  }
  return parseResponse<T>(response);
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result = await parseResponse<{ access_token: string }>(response);
      accessToken = result.access_token;
      return accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok) {
    const code = typeof data?.code === "string" ? data.code : "REQUEST_FAILED";
    throw new AdminApiError(
      getAdminErrorMessage(
        code,
        typeof data?.message === "string" ? data.message : undefined,
      ),
      response.status,
      code,
    );
  }
  return data as T;
}

function getAdminErrorMessage(code: string, fallback?: string): string {
  const messages: Record<string, string> = {
    ADMIN_ACCESS_REQUIRED: "이 계정에는 Lynx 관리자 권한이 없습니다.",
    ADMIN_AUDIT_LOG_NOT_FOUND: "감사 기록을 찾을 수 없습니다.",
    ADMIN_API_KEY_NOT_FOUND: "API Key를 찾을 수 없습니다.",
    ADMIN_PLAN_NOT_FOUND: "요금제를 찾을 수 없습니다.",
    ADMIN_PLAN_CODE_EXISTS: "이미 사용 중인 요금제 코드입니다.",
    ADMIN_PLAN_INACTIVE: "비활성 요금제는 조직에 새로 할당할 수 없습니다.",
    ADMIN_PILOT_PARTICIPANT_NOT_FOUND: "파일럿 사용 대상을 찾을 수 없습니다.",
    ADMIN_SUPER_ADMIN_REQUIRED:
      "슈퍼어드민만 다른 사용자에게 관리자 권한을 부여하거나 회수할 수 있습니다.",
    ADMIN_SUPER_ADMIN_PROTECTED:
      "슈퍼어드민 권한은 사용자 관리 화면에서 변경할 수 없습니다.",
    USER_NOT_FOUND: "사용자를 찾을 수 없습니다.",
    ACCESS_INVITATION_NOT_FOUND: "파일럿 초대를 찾을 수 없습니다.",
    COULD_NOT_SEND_EMAIL: "초대 메일을 보내지 못했습니다.",
    INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
    TOKEN_EXPIRED: "로그인 세션이 만료되었습니다.",
    INVALID_INPUT: "입력한 값을 다시 확인해 주세요.",
  };
  return messages[code] ?? fallback ?? "관리자 요청을 처리하지 못했습니다.";
}

function toQuery(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
