export interface AuditActor {
  id: string;
  name: string | null;
  email: string | null;
}

export type AdminApiKeyStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type AdminApiKeyKind = "INGEST" | "SDK" | "AUTOMATION";
export type OpenApiUsagePeriod = "24h" | "7d" | "30d";

export interface AdminApiKey {
  id: string;
  name: string;
  prefix: string;
  kind: AdminApiKeyKind;
  scopes: string[];
  status: AdminApiKeyStatus;
  workspace: { id: string; name: string };
  organization: { id: string; name: string };
  createdBy: { id: string | null; name: string | null };
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface AdminApiKeyList {
  items: AdminApiKey[];
  nextCursor: string | null;
}

export interface OpenApiUsage {
  range: {
    from: string;
    to: string;
    period: OpenApiUsagePeriod;
  };
  keyStatus: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
  };
  summary: {
    requestCount: number;
    successCount: number;
    clientErrorCount: number;
    serverErrorCount: number;
    rateLimitedCount: number;
    acceptedEventCount: number;
    rejectedEventCount: number;
    requestBytes: number;
    responseBytes: number;
    averageLatencyMs: number;
    successRate: number;
  };
  dailyTrend: Array<{
    date: string;
    requestCount: number;
    errorCount: number;
    rateLimitedCount: number;
    acceptedEventCount: number;
  }>;
  endpoints: Array<{
    endpoint: string;
    requestCount: number;
    errorCount: number;
    rateLimitedCount: number;
    averageLatencyMs: number;
  }>;
  keys: Array<{
    apiKeyId: string;
    name: string;
    prefix: string;
    workspace: { id: string; name: string };
    organization: { id: string; name: string };
    requestCount: number;
    errorCount: number;
    rateLimitedCount: number;
    acceptedEventCount: number;
    lastUsedAt: string | null;
  }>;
}

export interface AuditLogSummary {
  id: string;
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId: string;
  workspaceId: string | null;
  organizationId: string | null;
  requestId: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  hasPayload: boolean;
  createdAt: string;
}

export interface AuditLogDetail extends AuditLogSummary {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestData: unknown;
  responseData: unknown;
  metadata: Record<string, unknown> | null;
}

export interface AuditLogList {
  items: AuditLogSummary[];
  nextCursor: string | null;
}

export interface AdminPlan {
  id: string;
  code: string;
  name: string;
  maxWorkspaces: number | null;
  maxMembers: number | null;
  retentionDays: number;
  monthlyEventLimit: number | null;
  includedLogCount: number | null;
  logOverageUnitPrice: number | null;
  features: Record<string, unknown>;
  isActive: boolean;
  organizationCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PlanInput = Omit<
  AdminPlan,
  "id" | "organizationCount" | "createdAt" | "updatedAt"
>;

export interface OrganizationSummary {
  id: string;
  name: string;
  owner: { id: string; name: string; email: string };
  plan: Omit<AdminPlan, "organizationCount" | "createdAt" | "updatedAt">;
  workspaceCount: number;
  memberCount: number;
  storedEventCount: number;
  latestEventAt: string | null;
  createdAt: string;
}

export interface OrganizationDetail extends OrganizationSummary {
  workspaces: Array<{
    id: string;
    name: string;
    memberCount: number;
    agentCount: number;
    sessionCount: number;
    runCount: number;
    eventCount: number;
    totalCost: number;
    latestEventAt: string | null;
  }>;
  members: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    joinedAt: string;
  }>;
  currentMonthUsage: {
    eventCount: number;
    sessionCount: number;
    totalCost: number;
  };
  storedData: {
    eventCount: number;
    sessionCount: number;
    runCount: number;
    agentCount: number;
    issueCount: number;
    openIssueCount: number;
    firewallViolationCount: number;
    promptCount: number;
    firstEventAt: string | null;
    latestEventAt: string | null;
  };
  recentUsage: {
    eventCount24h: number;
    eventCount7d: number;
    eventCount30d: number;
    sessionCount7d: number;
    runCount7d: number;
    totalCost7d: number;
    totalCost30d: number;
    promptTokens30d: number;
    completionTokens30d: number;
  };
  eventTypeDistribution: Array<{
    eventType: string;
    eventCount: number;
  }>;
  agentUsage: Array<{
    agentId: string;
    agentName: string;
    sessionCount: number;
    eventCount: number;
    totalCost: number;
  }>;
  dailyEventTrend: Array<{
    date: string;
    eventCount: number;
    totalCost: number;
  }>;
  recentAuditLogs: AuditLogSummary[];
}

export interface OrganizationList {
  items: OrganizationSummary[];
  nextCursor: string | null;
}

export interface AdminOverview {
  currentAdmin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  metrics: {
    organizationCount: number;
    activePlanCount: number;
    auditLogCount24h: number;
    workspaceCount: number;
  };
  planDistribution: Array<{
    planId: string;
    code: string;
    name: string;
    organizationCount: number;
  }>;
  recentAuditLogs: AuditLogSummary[];
}

export type AccessInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export interface AccessInvitation {
  id: string;
  email: string;
  status: AccessInvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface AccessInvitationList {
  items: AccessInvitation[];
  nextCursor: string | null;
}

export type PilotParticipantStatus = "ACTIVE" | "SUSPENDED" | "EXPIRED";

export interface PilotParticipant {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  status: PilotParticipantStatus;
  grantedByUserId: string | null;
  grantedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PilotParticipantList {
  items: PilotParticipant[];
  nextCursor: string | null;
}
