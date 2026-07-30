import {
  ADMIN_ROLES,
  API_KEY_SCOPES,
  PRODUCT_ACCESS_GRANT_STATUS,
  WORKSPACE_API_KEY_KINDS,
} from "@repo/constants";
import { z } from "zod";

const NullablePositiveIntegerSchema = z.number().int().positive().nullable();
const AuditObjectSchema = z.record(z.string(), z.unknown()).nullable();

export const ADMIN_API_KEY_STATUS = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;

export const ADMIN_OPENAPI_USAGE_PERIOD = {
  LAST_24_HOURS: "24h",
  LAST_7_DAYS: "7d",
  LAST_30_DAYS: "30d",
} as const;

export const AdminApiKeyQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  organizationId: z.uuid().optional(),
  workspaceId: z.uuid().optional(),
  status: z.enum(ADMIN_API_KEY_STATUS).optional(),
  kind: z.enum(WORKSPACE_API_KEY_KINDS).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminApiKeyParamsSchema = z.object({
  apiKeyId: z.uuid(),
});

export const AdminApiKeySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  kind: z.enum(WORKSPACE_API_KEY_KINDS),
  scopes: z.array(z.enum(API_KEY_SCOPES)),
  status: z.enum(ADMIN_API_KEY_STATUS),
  workspace: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
  organization: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
  createdBy: z.object({
    id: z.uuid().nullable(),
    name: z.string().nullable(),
  }),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});

export const AdminApiKeyListResponseSchema = z.object({
  items: z.array(AdminApiKeySchema),
  nextCursor: z.string().nullable(),
});

export const AdminOpenApiUsageQuerySchema = z.object({
  organizationId: z.uuid().optional(),
  workspaceId: z.uuid().optional(),
  apiKeyId: z.uuid().optional(),
  period: z
    .enum(ADMIN_OPENAPI_USAGE_PERIOD)
    .default(ADMIN_OPENAPI_USAGE_PERIOD.LAST_7_DAYS),
});

const AdminOpenApiUsageCountSchema = z.number().int().nonnegative();

export const AdminOpenApiUsageResponseSchema = z.object({
  range: z.object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    period: z.enum(ADMIN_OPENAPI_USAGE_PERIOD),
  }),
  keyStatus: z.object({
    total: AdminOpenApiUsageCountSchema,
    active: AdminOpenApiUsageCountSchema,
    expired: AdminOpenApiUsageCountSchema,
    revoked: AdminOpenApiUsageCountSchema,
  }),
  summary: z.object({
    requestCount: AdminOpenApiUsageCountSchema,
    successCount: AdminOpenApiUsageCountSchema,
    clientErrorCount: AdminOpenApiUsageCountSchema,
    serverErrorCount: AdminOpenApiUsageCountSchema,
    rateLimitedCount: AdminOpenApiUsageCountSchema,
    acceptedEventCount: AdminOpenApiUsageCountSchema,
    rejectedEventCount: AdminOpenApiUsageCountSchema,
    requestBytes: AdminOpenApiUsageCountSchema,
    responseBytes: AdminOpenApiUsageCountSchema,
    averageLatencyMs: z.number().nonnegative(),
    successRate: z.number().min(0).max(100),
  }),
  dailyTrend: z.array(
    z.object({
      date: z.iso.date(),
      requestCount: AdminOpenApiUsageCountSchema,
      errorCount: AdminOpenApiUsageCountSchema,
      rateLimitedCount: AdminOpenApiUsageCountSchema,
      acceptedEventCount: AdminOpenApiUsageCountSchema,
    }),
  ),
  endpoints: z.array(
    z.object({
      endpoint: z.string(),
      requestCount: AdminOpenApiUsageCountSchema,
      errorCount: AdminOpenApiUsageCountSchema,
      rateLimitedCount: AdminOpenApiUsageCountSchema,
      averageLatencyMs: z.number().nonnegative(),
    }),
  ),
  keys: z.array(
    z.object({
      apiKeyId: z.uuid(),
      name: z.string(),
      prefix: z.string(),
      workspace: z.object({
        id: z.uuid(),
        name: z.string(),
      }),
      organization: z.object({
        id: z.uuid(),
        name: z.string(),
      }),
      requestCount: AdminOpenApiUsageCountSchema,
      errorCount: AdminOpenApiUsageCountSchema,
      rateLimitedCount: AdminOpenApiUsageCountSchema,
      acceptedEventCount: AdminOpenApiUsageCountSchema,
      lastUsedAt: z.iso.datetime().nullable(),
    }),
  ),
});

export const AdminAuditLogQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  action: z.string().trim().max(120).optional(),
  targetType: z.string().trim().max(120).optional(),
  actorUserId: z.uuid().optional(),
  workspaceId: z.uuid().optional(),
  organizationId: z.uuid().optional(),
  requestId: z.string().trim().max(120).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminAuditLogParamsSchema = z.object({
  auditLogId: z.uuid(),
});

export const AdminAuditActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
});

export const AdminAuditLogSummarySchema = z.object({
  id: z.uuid(),
  actor: AdminAuditActorSchema,
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  workspaceId: z.uuid().nullable(),
  organizationId: z.uuid().nullable(),
  requestId: z.string().nullable(),
  method: z.string().nullable(),
  path: z.string().nullable(),
  statusCode: z.number().int().nullable(),
  hasPayload: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const AdminAuditLogDetailSchema = AdminAuditLogSummarySchema.extend({
  before: AuditObjectSchema,
  after: AuditObjectSchema,
  requestData: z.unknown().nullable(),
  responseData: z.unknown().nullable(),
  metadata: AuditObjectSchema,
});

export const AdminAuditLogListResponseSchema = z.object({
  items: z.array(AdminAuditLogSummarySchema),
  nextCursor: z.string().nullable(),
});

export const AdminPlanCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/);

export const AdminPlanInputSchema = z.object({
  code: AdminPlanCodeSchema,
  name: z.string().trim().min(1).max(120),
  maxWorkspaces: NullablePositiveIntegerSchema,
  maxMembers: NullablePositiveIntegerSchema,
  retentionDays: z.number().int().positive(),
  monthlyEventLimit: NullablePositiveIntegerSchema,
  includedLogCount: z.number().int().nonnegative().nullable(),
  logOverageUnitPrice: z.number().nonnegative().nullable(),
  features: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
});

export const AdminPlanUpdateSchema = AdminPlanInputSchema.omit({
  code: true,
})
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    "At least one field must be provided.",
  );

export const AdminPlanParamsSchema = z.object({
  planId: z.uuid(),
});

export const AdminPlanSchema = AdminPlanInputSchema.extend({
  id: z.uuid(),
  organizationCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const AdminPlanListResponseSchema = z.object({
  items: z.array(AdminPlanSchema),
});

export const AdminOrganizationQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  planId: z.uuid().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminOrganizationParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const AdminOrganizationPlanUpdateSchema = z.object({
  planId: z.uuid(),
});

export const AdminOrganizationSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  owner: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
  }),
  plan: AdminPlanSchema.omit({
    organizationCount: true,
    createdAt: true,
    updatedAt: true,
  }).extend({ id: z.uuid() }),
  workspaceCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  storedEventCount: z.number().int().nonnegative(),
  latestEventAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const AdminOrganizationListResponseSchema = z.object({
  items: z.array(AdminOrganizationSummarySchema),
  nextCursor: z.string().nullable(),
});

export const AdminOrganizationDetailSchema =
  AdminOrganizationSummarySchema.extend({
    workspaces: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        memberCount: z.number().int().nonnegative(),
        agentCount: z.number().int().nonnegative(),
        sessionCount: z.number().int().nonnegative(),
        runCount: z.number().int().nonnegative(),
        eventCount: z.number().int().nonnegative(),
        totalCost: z.number().nonnegative(),
        latestEventAt: z.iso.datetime().nullable(),
      }),
    ),
    members: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.string(),
        role: z.string(),
        joinedAt: z.iso.datetime(),
      }),
    ),
    currentMonthUsage: z.object({
      eventCount: z.number().int().nonnegative(),
      sessionCount: z.number().int().nonnegative(),
      totalCost: z.number().nonnegative(),
    }),
    storedData: z.object({
      eventCount: z.number().int().nonnegative(),
      sessionCount: z.number().int().nonnegative(),
      runCount: z.number().int().nonnegative(),
      agentCount: z.number().int().nonnegative(),
      issueCount: z.number().int().nonnegative(),
      openIssueCount: z.number().int().nonnegative(),
      firewallViolationCount: z.number().int().nonnegative(),
      promptCount: z.number().int().nonnegative(),
      firstEventAt: z.iso.datetime().nullable(),
      latestEventAt: z.iso.datetime().nullable(),
    }),
    recentUsage: z.object({
      eventCount24h: z.number().int().nonnegative(),
      eventCount7d: z.number().int().nonnegative(),
      eventCount30d: z.number().int().nonnegative(),
      sessionCount7d: z.number().int().nonnegative(),
      runCount7d: z.number().int().nonnegative(),
      totalCost7d: z.number().nonnegative(),
      totalCost30d: z.number().nonnegative(),
      promptTokens30d: z.number().int().nonnegative(),
      completionTokens30d: z.number().int().nonnegative(),
    }),
    eventTypeDistribution: z.array(
      z.object({
        eventType: z.string(),
        eventCount: z.number().int().nonnegative(),
      }),
    ),
    agentUsage: z.array(
      z.object({
        agentId: z.uuid(),
        agentName: z.string(),
        sessionCount: z.number().int().nonnegative(),
        eventCount: z.number().int().nonnegative(),
        totalCost: z.number().nonnegative(),
      }),
    ),
    dailyEventTrend: z.array(
      z.object({
        date: z.iso.date(),
        eventCount: z.number().int().nonnegative(),
        totalCost: z.number().nonnegative(),
      }),
    ),
    recentAuditLogs: z.array(AdminAuditLogSummarySchema),
  });

export const ADMIN_USER_ACCESS_FILTER = {
  NONE: "NONE",
  ADMIN: ADMIN_ROLES.ADMIN,
  SENIOR_ADMIN: ADMIN_ROLES.SENIOR_ADMIN,
  SUPER_ADMIN: ADMIN_ROLES.SUPER_ADMIN,
  VIEWER: ADMIN_ROLES.VIEWER,
} as const;

export const AdminUserQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  access: z.enum(ADMIN_USER_ACCESS_FILTER).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminUserParamsSchema = z.object({
  userId: z.uuid(),
});

export const AdminUserAccessUpdateSchema = z.object({
  role: z.enum(ADMIN_ROLES).nullable(),
});

export const AdminUserDeleteSchema = z.object({
  confirmationEmail: z.email(),
});

export const AdminUserSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  profileImageUrl: z.url().nullable(),
  adminAccess: z
    .object({
      role: z.enum(ADMIN_ROLES),
      isActive: z.boolean(),
    })
    .nullable(),
  organizationCount: z.number().int().nonnegative(),
  workspaceCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const AdminUserListResponseSchema = z.object({
  items: z.array(AdminUserSummarySchema),
  nextCursor: z.string().nullable(),
});

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  loginProviders: z.array(z.string()),
  organizations: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      role: z.string(),
      joinedAt: z.iso.datetime(),
    }),
  ),
  workspaces: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      organizationId: z.uuid(),
      organizationName: z.string(),
      role: z.string(),
      joinedAt: z.iso.datetime(),
    }),
  ),
  entitlement: z
    .object({
      tier: z.string(),
      maxOwnedOrganizations: z.number().int().nonnegative().nullable(),
      dailyOrganizationCreateLimit: z.number().int().nonnegative(),
      source: z.string(),
      expiresAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  pilotAccess: z
    .object({
      status: z.enum(PRODUCT_ACCESS_GRANT_STATUS),
      grantedAt: z.iso.datetime(),
      expiresAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});

export const AdminPilotParticipantQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(PRODUCT_ACCESS_GRANT_STATUS).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminPilotParticipantParamsSchema = z.object({
  participantId: z.uuid(),
});

export const AdminPilotParticipantUpdateSchema = z.object({
  status: z.enum([
    PRODUCT_ACCESS_GRANT_STATUS.ACTIVE,
    PRODUCT_ACCESS_GRANT_STATUS.SUSPENDED,
  ]),
  expiresAt: z.iso.datetime().nullable().optional(),
});

export const AdminPilotParticipantSchema = z.object({
  id: z.uuid(),
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  status: z.enum(PRODUCT_ACCESS_GRANT_STATUS),
  grantedByUserId: z.uuid().nullable(),
  grantedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const AdminPilotParticipantListResponseSchema = z.object({
  items: z.array(AdminPilotParticipantSchema),
  nextCursor: z.string().nullable(),
});

export const AdminOverviewResponseSchema = z.object({
  currentAdmin: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(ADMIN_ROLES),
  }),
  metrics: z.object({
    organizationCount: z.number().int().nonnegative(),
    activePlanCount: z.number().int().nonnegative(),
    auditLogCount24h: z.number().int().nonnegative(),
    workspaceCount: z.number().int().nonnegative(),
  }),
  planDistribution: z.array(
    z.object({
      planId: z.uuid(),
      code: z.string(),
      name: z.string(),
      organizationCount: z.number().int().nonnegative(),
    }),
  ),
  recentAuditLogs: z.array(AdminAuditLogSummarySchema),
});

export type AdminAuditLogQueryDto = z.infer<typeof AdminAuditLogQuerySchema>;
export type AdminApiKeyQueryDto = z.infer<typeof AdminApiKeyQuerySchema>;
export type AdminApiKeyDto = z.infer<typeof AdminApiKeySchema>;
export type AdminOpenApiUsageQueryDto = z.infer<
  typeof AdminOpenApiUsageQuerySchema
>;
export type AdminOpenApiUsageResponseDto = z.infer<
  typeof AdminOpenApiUsageResponseSchema
>;
export type AdminAuditLogSummaryDto = z.infer<
  typeof AdminAuditLogSummarySchema
>;
export type AdminAuditLogDetailDto = z.infer<typeof AdminAuditLogDetailSchema>;
export type AdminPlanInputDto = z.infer<typeof AdminPlanInputSchema>;
export type AdminPlanUpdateDto = z.infer<typeof AdminPlanUpdateSchema>;
export type AdminPlanDto = z.infer<typeof AdminPlanSchema>;
export type AdminOrganizationQueryDto = z.infer<
  typeof AdminOrganizationQuerySchema
>;
export type AdminOrganizationSummaryDto = z.infer<
  typeof AdminOrganizationSummarySchema
>;
export type AdminOrganizationDetailDto = z.infer<
  typeof AdminOrganizationDetailSchema
>;
export type AdminUserQueryDto = z.infer<typeof AdminUserQuerySchema>;
export type AdminUserSummaryDto = z.infer<typeof AdminUserSummarySchema>;
export type AdminUserDetailDto = z.infer<typeof AdminUserDetailSchema>;
export type AdminUserAccessUpdateDto = z.infer<
  typeof AdminUserAccessUpdateSchema
>;
export type AdminUserDeleteDto = z.infer<typeof AdminUserDeleteSchema>;
export type AdminPilotParticipantQueryDto = z.infer<
  typeof AdminPilotParticipantQuerySchema
>;
export type AdminPilotParticipantUpdateDto = z.infer<
  typeof AdminPilotParticipantUpdateSchema
>;
export type AdminPilotParticipantDto = z.infer<
  typeof AdminPilotParticipantSchema
>;
export type AdminOverviewResponseDto = z.infer<
  typeof AdminOverviewResponseSchema
>;
