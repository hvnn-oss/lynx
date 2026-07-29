import { PRODUCT_ACCESS_GRANT_STATUS } from "@repo/constants";
import { z } from "zod";

const NullablePositiveIntegerSchema = z.number().int().positive().nullable();
const AuditObjectSchema = z.record(z.string(), z.unknown()).nullable();

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
    role: z.string(),
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
