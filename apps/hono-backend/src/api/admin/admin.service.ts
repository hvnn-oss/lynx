import {
  ADMIN_ROLES,
  ERROR_CODES,
  PRODUCT_ACCESS_GRANT_STATUS,
} from "@repo/constants";
import {
  ADMIN_API_KEY_STATUS,
  ADMIN_OPENAPI_USAGE_PERIOD,
} from "@repo/dto";
import type {
  AdminApiKeyDto,
  AdminApiKeyQueryDto,
  AdminAuditLogDetailDto,
  AdminAuditLogQueryDto,
  AdminAuditLogSummaryDto,
  AdminOrganizationDetailDto,
  AdminOrganizationQueryDto,
  AdminOrganizationSummaryDto,
  AdminOverviewResponseDto,
  AdminOpenApiUsageQueryDto,
  AdminOpenApiUsageResponseDto,
  AdminPilotParticipantDto,
  AdminPilotParticipantQueryDto,
  AdminPilotParticipantUpdateDto,
  AdminPlanDto,
  AdminPlanInputDto,
  AdminPlanUpdateDto,
  AdminUserDetailDto,
  AdminUserQueryDto,
  AdminUserSummaryDto,
} from "@repo/dto";
import { HTTPException } from "hono/http-exception";
import { env } from "../../common/config/config.js";
import {
  auditLogService,
  type AuditLogRecorder,
} from "../../common/services/audit-log.service.js";
import { getImageService } from "../../provider/image/image-provider.js";
import {
  AdminRepository,
  adminRepository,
  type AdminCursor,
  type RawAdminApiKey,
  type RawAuditLog,
  type RawOrganization,
  type RawAdminUser,
  type RawPilotParticipant,
  type RawPlan,
} from "./admin.repository.js";

const OVERVIEW_RECENT_AUDIT_LIMIT = 5;
const ORGANIZATION_RECENT_AUDIT_LIMIT = 10;

/** Lynx 운영자가 감사 기록, 조직, 요금제를 관리하는 유스케이스입니다. */
export class AdminService {
  constructor(
    private readonly repository: AdminRepository = adminRepository,
    private readonly auditRecorder: AuditLogRecorder = auditLogService,
  ) {}

  async getOverview(userId: string): Promise<AdminOverviewResponseDto> {
    const [currentAdmin, metrics, distribution, recentRows] = await Promise.all(
      [
        this.repository.getCurrentAdmin(userId),
        this.repository.getOverviewCounts(),
        this.repository.getPlanDistribution(),
        this.repository.listAuditLogs({ limit: OVERVIEW_RECENT_AUDIT_LIMIT }),
      ],
    );
    if (!currentAdmin) {
      throw new HTTPException(403, {
        message: ERROR_CODES.ADMIN_ACCESS_REQUIRED,
      });
    }
    return {
      currentAdmin,
      metrics,
      planDistribution: distribution.map((item) => ({
        ...item,
        organizationCount: this.toInteger(item.organizationCount),
      })),
      recentAuditLogs: recentRows
        .slice(0, OVERVIEW_RECENT_AUDIT_LIMIT)
        .map((row) => this.toAuditSummary(row)),
    };
  }

  async listAuditLogs(input: AdminAuditLogQueryDto) {
    const rows = await this.repository.listAuditLogs({
      ...input,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      cursor: input.cursor ? this.decodeCursor(input.cursor) : undefined,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((row) => this.toAuditSummary(row)),
      nextCursor:
        hasNext && items.length > 0
          ? this.encodeCursor(items[items.length - 1]!)
          : null,
    };
  }

  async getAuditLog(auditLogId: string): Promise<AdminAuditLogDetailDto> {
    const row = await this.repository.getAuditLog(auditLogId);
    if (!row) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_AUDIT_LOG_NOT_FOUND,
      });
    }
    const metadata = row.metadata ?? {};
    return {
      ...this.toAuditSummary(row),
      before: row.before,
      after: row.after,
      requestData: metadata.request ?? null,
      responseData: metadata.response ?? null,
      metadata: row.metadata,
    };
  }

  /** API Key의 비밀값을 제외한 운영 메타데이터를 커서 기반으로 반환합니다. */
  async listApiKeys(input: AdminApiKeyQueryDto) {
    const rows = await this.repository.listApiKeys({
      ...input,
      cursor: input.cursor ? this.decodeCursor(input.cursor) : undefined,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((row) => this.toAdminApiKey(row)),
      nextCursor:
        hasNext && items.length > 0
          ? this.encodeCursor(items[items.length - 1]!)
          : null,
    };
  }

  /** 관리자 필터에 맞는 API Key 상태와 OpenAPI 사용량을 함께 집계합니다. */
  async getOpenApiUsage(
    input: AdminOpenApiUsageQueryDto,
  ): Promise<AdminOpenApiUsageResponseDto> {
    const to = new Date();
    const from = new Date(to.getTime() - this.getUsagePeriodMs(input.period));
    const filters = {
      from,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      apiKeyId: input.apiKeyId,
    };
    const [keyStatus, summary, dailyTrend, endpoints, keys] = await Promise.all([
      this.repository.getApiKeyStatusCounts(input),
      this.repository.getOpenApiUsageSummary(filters),
      this.repository.listOpenApiDailyUsage(filters),
      this.repository.listOpenApiEndpointUsage(filters),
      this.repository.listOpenApiKeyUsage(filters),
    ]);
    const requestCount = this.toInteger(summary?.requestCount ?? 0);
    const successCount = this.toInteger(summary?.successCount ?? 0);

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        period: input.period,
      },
      keyStatus: {
        total: this.toInteger(keyStatus?.total ?? 0),
        active: this.toInteger(keyStatus?.active ?? 0),
        expired: this.toInteger(keyStatus?.expired ?? 0),
        revoked: this.toInteger(keyStatus?.revoked ?? 0),
      },
      summary: {
        requestCount,
        successCount,
        clientErrorCount: this.toInteger(summary?.clientErrorCount ?? 0),
        serverErrorCount: this.toInteger(summary?.serverErrorCount ?? 0),
        rateLimitedCount: this.toInteger(summary?.rateLimitedCount ?? 0),
        acceptedEventCount: this.toInteger(
          summary?.acceptedEventCount ?? 0,
        ),
        rejectedEventCount: this.toInteger(
          summary?.rejectedEventCount ?? 0,
        ),
        requestBytes: this.toInteger(summary?.requestBytes ?? 0),
        responseBytes: this.toInteger(summary?.responseBytes ?? 0),
        averageLatencyMs: this.average(
          summary?.totalLatencyMs ?? 0,
          requestCount,
        ),
        successRate:
          requestCount === 0
            ? 0
            : this.round((successCount / requestCount) * 100),
      },
      dailyTrend: dailyTrend.map((item) => ({
        date: item.date,
        requestCount: this.toInteger(item.requestCount),
        errorCount: this.toInteger(item.errorCount),
        rateLimitedCount: this.toInteger(item.rateLimitedCount),
        acceptedEventCount: this.toInteger(item.acceptedEventCount),
      })),
      endpoints: endpoints.map((item) => {
        const endpointRequestCount = this.toInteger(item.requestCount);
        return {
          endpoint: item.endpoint,
          requestCount: endpointRequestCount,
          errorCount: this.toInteger(item.errorCount),
          rateLimitedCount: this.toInteger(item.rateLimitedCount),
          averageLatencyMs: this.average(
            item.totalLatencyMs,
            endpointRequestCount,
          ),
        };
      }),
      keys: keys.map((item) => ({
        apiKeyId: item.apiKeyId,
        name: item.name,
        prefix: item.prefix,
        workspace: {
          id: item.workspaceId,
          name: item.workspaceName,
        },
        organization: {
          id: item.organizationId,
          name: item.organizationName,
        },
        requestCount: this.toInteger(item.requestCount),
        errorCount: this.toInteger(item.errorCount),
        rateLimitedCount: this.toInteger(item.rateLimitedCount),
        acceptedEventCount: this.toInteger(item.acceptedEventCount),
        lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  /** API Key를 즉시 폐기하고 비밀값 없는 변경 기록을 감사 로그에 남깁니다. */
  async revokeApiKey(
    actorUserId: string,
    apiKeyId: string,
    requestId?: string,
  ): Promise<AdminApiKeyDto> {
    const beforeRow = await this.repository.getApiKey(apiKeyId);
    if (!beforeRow) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_API_KEY_NOT_FOUND,
      });
    }
    if (beforeRow.revokedAt) return this.toAdminApiKey(beforeRow);

    if (!(await this.repository.revokeApiKey(apiKeyId, new Date()))) {
      const current = await this.repository.getApiKey(apiKeyId);
      if (current?.revokedAt) return this.toAdminApiKey(current);
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_API_KEY_NOT_FOUND,
      });
    }

    const afterRow = await this.repository.getApiKey(apiKeyId);
    if (!afterRow) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_API_KEY_NOT_FOUND,
      });
    }
    const before = this.toAdminApiKey(beforeRow);
    const after = this.toAdminApiKey(afterRow);
    await this.auditRecorder.record({
      actorUserId,
      action: "workspace_api_key.admin_revoke",
      targetType: "workspace_api_key",
      targetId: apiKeyId,
      workspaceId: after.workspace.id,
      organizationId: after.organization.id,
      requestId,
      before,
      after,
      metadata: {
        method: "PATCH",
        path: `/admin/api-keys/${apiKeyId}/revoke`,
        statusCode: 200,
        response: { body: after },
      },
    });
    return after;
  }

  async listPlans(): Promise<{ items: AdminPlanDto[] }> {
    return {
      items: (await this.repository.listPlans()).map((row) => this.toPlan(row)),
    };
  }

  async createPlan(
    actorUserId: string,
    input: AdminPlanInputDto,
    requestId?: string,
  ): Promise<AdminPlanDto> {
    try {
      const created = await this.repository.createPlan(input);
      const result = await this.getPlanOrThrow(created.id);
      await this.auditRecorder.record({
        actorUserId,
        action: "organization_plan.create",
        targetType: "organization_plan",
        targetId: result.id,
        requestId,
        after: result,
        metadata: {
          method: "POST",
          path: "/admin/plans",
          statusCode: 201,
          request: { body: input },
          response: { body: result },
        },
      });
      return result;
    } catch (error) {
      this.rethrowPlanConflict(error);
    }
  }

  async updatePlan(
    actorUserId: string,
    planId: string,
    input: AdminPlanUpdateDto,
    requestId?: string,
  ): Promise<AdminPlanDto> {
    const before = await this.getPlanOrThrow(planId);
    try {
      if (!(await this.repository.updatePlan(planId, input))) {
        throw new HTTPException(404, {
          message: ERROR_CODES.ADMIN_PLAN_NOT_FOUND,
        });
      }
      const after = await this.getPlanOrThrow(planId);
      await this.auditRecorder.record({
        actorUserId,
        action: "organization_plan.update",
        targetType: "organization_plan",
        targetId: planId,
        requestId,
        before,
        after,
        metadata: {
          method: "PATCH",
          path: `/admin/plans/${planId}`,
          statusCode: 200,
          request: { body: input },
          response: { body: after },
        },
      });
      return after;
    } catch (error) {
      this.rethrowPlanConflict(error);
    }
  }

  async listOrganizations(input: AdminOrganizationQueryDto) {
    const rows = await this.repository.listOrganizations({
      ...input,
      cursor: input.cursor ? this.decodeCursor(input.cursor) : undefined,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((row) => this.toOrganizationSummary(row)),
      nextCursor:
        hasNext && items.length > 0
          ? this.encodeCursor(items[items.length - 1]!)
          : null,
    };
  }

  async getOrganization(
    organizationId: string,
  ): Promise<AdminOrganizationDetailDto> {
    const organization = await this.repository.getOrganization(organizationId);
    if (!organization) {
      throw new HTTPException(404, { message: ERROR_CODES.ORG_NOT_FOUND });
    }
    const [
      workspaces,
      members,
      usage,
      storedData,
      recentUsage,
      eventTypes,
      agentUsage,
      dailyEventTrend,
      auditRows,
    ] = await Promise.all([
      this.repository.listOrganizationWorkspaces(organizationId),
      this.repository.listOrganizationMembers(organizationId),
      this.repository.getOrganizationUsage(organizationId),
      this.repository.getOrganizationStoredData(organizationId),
      this.repository.getOrganizationRecentUsage(organizationId),
      this.repository.listOrganizationEventTypes(organizationId),
      this.repository.listOrganizationAgentUsage(organizationId),
      this.repository.listOrganizationDailyEventTrend(organizationId),
      this.repository.listAuditLogs({
        organizationId,
        limit: ORGANIZATION_RECENT_AUDIT_LIMIT,
      }),
    ]);
    return {
      ...this.toOrganizationSummary(organization),
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        memberCount: this.toInteger(workspace.memberCount),
        agentCount: this.toInteger(workspace.agentCount),
        sessionCount: this.toInteger(workspace.sessionCount),
        runCount: this.toInteger(workspace.runCount),
        eventCount: this.toInteger(workspace.eventCount),
        totalCost: this.toNumber(workspace.totalCost),
        latestEventAt: workspace.latestEventAt?.toISOString() ?? null,
      })),
      members: members.map((member) => ({
        ...member,
        joinedAt: member.joinedAt.toISOString(),
      })),
      currentMonthUsage: {
        eventCount: this.toInteger(usage.eventCount),
        sessionCount: this.toInteger(usage.sessionCount),
        totalCost: this.toNumber(usage.totalCost),
      },
      storedData: {
        eventCount: this.toInteger(storedData.eventCount),
        sessionCount: this.toInteger(storedData.sessionCount),
        runCount: this.toInteger(storedData.runCount),
        agentCount: this.toInteger(storedData.agentCount),
        issueCount: this.toInteger(storedData.issueCount),
        openIssueCount: this.toInteger(storedData.openIssueCount),
        firewallViolationCount: this.toInteger(
          storedData.firewallViolationCount,
        ),
        promptCount: this.toInteger(storedData.promptCount),
        firstEventAt: storedData.firstEventAt?.toISOString() ?? null,
        latestEventAt: storedData.latestEventAt?.toISOString() ?? null,
      },
      recentUsage: {
        eventCount24h: this.toInteger(recentUsage.eventCount24h),
        eventCount7d: this.toInteger(recentUsage.eventCount7d),
        eventCount30d: this.toInteger(recentUsage.eventCount30d),
        sessionCount7d: this.toInteger(recentUsage.sessionCount7d),
        runCount7d: this.toInteger(recentUsage.runCount7d),
        totalCost7d: this.toNumber(recentUsage.totalCost7d),
        totalCost30d: this.toNumber(recentUsage.totalCost30d),
        promptTokens30d: this.toInteger(recentUsage.promptTokens30d ?? 0),
        completionTokens30d: this.toInteger(
          recentUsage.completionTokens30d ?? 0,
        ),
      },
      eventTypeDistribution: eventTypes.map((item) => ({
        eventType: item.eventType,
        eventCount: this.toInteger(item.eventCount),
      })),
      agentUsage: agentUsage.map((item) => ({
        agentId: item.agentId,
        agentName: item.agentName,
        sessionCount: this.toInteger(item.sessionCount),
        eventCount: this.toInteger(item.eventCount),
        totalCost: this.toNumber(item.totalCost),
      })),
      dailyEventTrend: dailyEventTrend.map((item) => ({
        date: item.date,
        eventCount: this.toInteger(item.eventCount),
        totalCost: this.toNumber(item.totalCost),
      })),
      recentAuditLogs: auditRows
        .slice(0, ORGANIZATION_RECENT_AUDIT_LIMIT)
        .map((row) => this.toAuditSummary(row)),
    };
  }

  async listUsers(input: AdminUserQueryDto) {
    const rows = await this.repository.listUsers({
      ...input,
      cursor: input.cursor ? this.decodeCursor(input.cursor) : undefined,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((row) => this.toUserSummary(row)),
      nextCursor:
        hasNext && items.length > 0
          ? this.encodeCursor(items[items.length - 1]!)
          : null,
    };
  }

  async getUser(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.repository.getUser(userId);
    if (!user) {
      throw new HTTPException(404, { message: ERROR_CODES.USER_NOT_FOUND });
    }
    const [loginProviders, organizations, workspaces, entitlement, pilotAccess] =
      await Promise.all([
        this.repository.listUserLoginProviders(userId),
        this.repository.listUserOrganizations(userId),
        this.repository.listUserWorkspaces(userId),
        this.repository.getUserEntitlement(userId),
        this.repository.getUserPilotAccess(userId),
      ]);

    return {
      ...this.toUserSummary(user),
      loginProviders,
      organizations: organizations.map((organization) => ({
        ...organization,
        joinedAt: organization.joinedAt.toISOString(),
      })),
      workspaces: workspaces.map((workspace) => ({
        ...workspace,
        joinedAt: workspace.joinedAt.toISOString(),
      })),
      entitlement: entitlement
        ? {
            tier: entitlement.tier,
            maxOwnedOrganizations: entitlement.maxOwnedOrganizations,
            dailyOrganizationCreateLimit:
              entitlement.dailyOrganizationCreateLimit,
            source: entitlement.source,
            expiresAt: entitlement.expiresAt?.toISOString() ?? null,
          }
        : null,
      pilotAccess: pilotAccess
        ? {
            status: pilotAccess.status,
            grantedAt: pilotAccess.grantedAt.toISOString(),
            expiresAt: pilotAccess.expiresAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * SUPER_ADMIN만 기존 사용자에게 운영자 권한을 부여하거나 회수할 수 있습니다.
   */
  async updateUserAdminAccess(
    actorUserId: string,
    userId: string,
    isAdmin: boolean,
    requestId?: string,
  ): Promise<AdminUserDetailDto> {
    const actor = await this.repository.getCurrentAdmin(actorUserId);
    if (actor?.role !== ADMIN_ROLES.SUPER_ADMIN) {
      throw new HTTPException(403, {
        message: ERROR_CODES.ADMIN_SUPER_ADMIN_REQUIRED,
      });
    }

    const before = await this.getUser(userId);
    if (
      before.adminAccess?.isActive &&
      before.adminAccess.role === ADMIN_ROLES.SUPER_ADMIN
    ) {
      throw new HTTPException(409, {
        message: ERROR_CODES.ADMIN_SUPER_ADMIN_PROTECTED,
      });
    }
    if (!(await this.repository.setUserAdminAccess(userId, isAdmin))) {
      throw new HTTPException(404, { message: ERROR_CODES.USER_NOT_FOUND });
    }

    const after = await this.getUser(userId);
    await this.auditRecorder.record({
      actorUserId,
      action: isAdmin ? "admin_user.grant" : "admin_user.revoke",
      targetType: "user",
      targetId: userId,
      requestId,
      before: { adminAccess: before.adminAccess },
      after: { adminAccess: after.adminAccess },
      metadata: {
        method: "PATCH",
        path: `/admin/users/${userId}/admin-access`,
        statusCode: 200,
        request: { body: { isAdmin } },
        response: { body: { userId, adminAccess: after.adminAccess } },
      },
    });
    return after;
  }

  async listPilotParticipants(input: AdminPilotParticipantQueryDto) {
    const rows = await this.repository.listPilotParticipants({
      ...input,
      cursor: input.cursor ? this.decodeCursor(input.cursor) : undefined,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((row) => this.toPilotParticipant(row)),
      nextCursor:
        hasNext && items.length > 0
          ? this.encodeCursor(items[items.length - 1]!)
          : null,
    };
  }

  async updatePilotParticipant(
    actorUserId: string,
    participantId: string,
    input: AdminPilotParticipantUpdateDto,
    requestId?: string,
  ): Promise<AdminPilotParticipantDto> {
    const beforeRow = await this.repository.getPilotParticipant(participantId);
    if (!beforeRow) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_PILOT_PARTICIPANT_NOT_FOUND,
      });
    }
    const expiresAt =
      input.expiresAt === undefined
        ? undefined
        : input.expiresAt === null
          ? null
          : new Date(input.expiresAt);
    if (
      !(await this.repository.updatePilotParticipant(participantId, {
        status: input.status,
        expiresAt,
      }))
    ) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_PILOT_PARTICIPANT_NOT_FOUND,
      });
    }
    const afterRow = await this.repository.getPilotParticipant(participantId);
    if (!afterRow) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_PILOT_PARTICIPANT_NOT_FOUND,
      });
    }
    const before = this.toPilotParticipant(beforeRow);
    const after = this.toPilotParticipant(afterRow);
    await this.auditRecorder.record({
      actorUserId,
      action:
        input.status === PRODUCT_ACCESS_GRANT_STATUS.ACTIVE
          ? "pilot_access.activate"
          : "pilot_access.suspend",
      targetType: "product_access_grant",
      targetId: participantId,
      requestId,
      before,
      after,
      metadata: {
        method: "PATCH",
        path: `/admin/pilot/participants/${participantId}`,
        statusCode: 200,
        request: { body: input },
        response: { body: after },
      },
    });
    return after;
  }

  async updateOrganizationPlan(
    actorUserId: string,
    organizationId: string,
    planId: string,
    requestId?: string,
  ): Promise<AdminOrganizationDetailDto> {
    const plan = await this.getPlanOrThrow(planId);
    if (!plan.isActive) {
      throw new HTTPException(409, {
        message: ERROR_CODES.ADMIN_PLAN_INACTIVE,
      });
    }
    const before = await this.getOrganization(organizationId);
    if (
      !(await this.repository.updateOrganizationPlan(organizationId, planId))
    ) {
      throw new HTTPException(404, { message: ERROR_CODES.ORG_NOT_FOUND });
    }
    const after = await this.getOrganization(organizationId);
    await this.auditRecorder.record({
      actorUserId,
      action: "organization.plan_change",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      requestId,
      before: { plan: before.plan },
      after: { plan: after.plan },
      metadata: {
        method: "PATCH",
        path: `/admin/organizations/${organizationId}/plan`,
        statusCode: 200,
        request: { body: { planId } },
        response: {
          body: {
            organizationId,
            plan: after.plan,
          },
        },
        selectedPlan: { id: plan.id, code: plan.code, name: plan.name },
      },
    });
    return after;
  }

  private async getPlanOrThrow(planId: string): Promise<AdminPlanDto> {
    const plan = await this.repository.getPlan(planId);
    if (!plan) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_PLAN_NOT_FOUND,
      });
    }
    return this.toPlan(plan);
  }

  private toAuditSummary(row: RawAuditLog): AdminAuditLogSummaryDto {
    const metadata = row.metadata ?? {};
    return {
      id: row.id,
      actor: {
        id: row.actorUserId,
        name: row.actorName,
        email: row.actorEmail,
      },
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      workspaceId: row.workspaceId,
      organizationId: row.organizationId,
      requestId: row.requestId,
      method: this.getMetadataString(metadata, "method"),
      path: this.getMetadataString(metadata, "path"),
      statusCode: this.getMetadataNumber(metadata, "statusCode"),
      hasPayload:
        row.before !== null ||
        row.after !== null ||
        metadata.request !== undefined ||
        metadata.response !== undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** 저장 모델을 비밀 필드가 없는 관리자 응답으로 변환합니다. */
  private toAdminApiKey(row: RawAdminApiKey): AdminApiKeyDto {
    const status = row.revokedAt
      ? ADMIN_API_KEY_STATUS.REVOKED
      : row.expiresAt && row.expiresAt.getTime() <= Date.now()
        ? ADMIN_API_KEY_STATUS.EXPIRED
        : ADMIN_API_KEY_STATUS.ACTIVE;
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      kind: row.kind,
      scopes: row.scopes,
      status,
      workspace: {
        id: row.workspaceId,
        name: row.workspaceName,
      },
      organization: {
        id: row.organizationId,
        name: row.organizationName,
      },
      createdBy: {
        id: row.createdByUserId,
        name: row.createdByName,
      },
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  private toPlan(row: RawPlan): AdminPlanDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      maxWorkspaces: row.maxWorkspaces,
      maxMembers: row.maxMembers,
      retentionDays: row.retentionDays,
      monthlyEventLimit: row.monthlyEventLimit,
      includedLogCount: row.includedLogCount,
      logOverageUnitPrice:
        row.logOverageUnitPrice === null
          ? null
          : this.toNumber(row.logOverageUnitPrice),
      features: row.features,
      isActive: row.isActive,
      organizationCount: this.toInteger(row.organizationCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toOrganizationSummary(
    row: RawOrganization,
  ): AdminOrganizationSummaryDto {
    return {
      id: row.id,
      name: row.name,
      owner: {
        id: row.ownerId,
        name: row.ownerName,
        email: row.ownerEmail,
      },
      plan: {
        id: row.planId,
        code: row.planCode,
        name: row.planName,
        maxWorkspaces: row.planMaxWorkspaces,
        maxMembers: row.planMaxMembers,
        retentionDays: row.planRetentionDays,
        monthlyEventLimit: row.planMonthlyEventLimit,
        includedLogCount: row.planIncludedLogCount,
        logOverageUnitPrice:
          row.planLogOverageUnitPrice === null
            ? null
            : this.toNumber(row.planLogOverageUnitPrice),
        features: row.planFeatures,
        isActive: row.planIsActive,
      },
      workspaceCount: this.toInteger(row.workspaceCount),
      memberCount: this.toInteger(row.memberCount),
      storedEventCount: this.toInteger(row.storedEventCount),
      latestEventAt: row.latestEventAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toPilotParticipant(
    row: RawPilotParticipant,
  ): AdminPilotParticipantDto {
    return {
      id: row.id,
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
      },
      status: row.status,
      grantedByUserId: row.grantedByUserId,
      grantedAt: row.grantedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toUserSummary(row: RawAdminUser): AdminUserSummaryDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      profileImageUrl: row.profileImageKey
        ? getImageService().getUrl(row.profileImageKey)
        : (env.DEFAULT_USER_PROFILE_IMAGE_URL ?? null),
      adminAccess:
        row.adminRole === null
          ? null
          : {
              role: row.adminRole,
              isActive: row.adminIsActive === true,
            },
      organizationCount: this.toInteger(row.organizationCount),
      workspaceCount: this.toInteger(row.workspaceCount),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private encodeCursor(row: { createdAt: Date; id: string }): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: row.createdAt.toISOString(),
        id: row.id,
      }),
    ).toString("base64url");
  }

  private decodeCursor(cursor: string): AdminCursor {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      ) as { createdAt?: unknown; id?: unknown };
      const createdAt = new Date(String(parsed.createdAt));
      if (
        Number.isNaN(createdAt.getTime()) ||
        typeof parsed.id !== "string" ||
        parsed.id.length === 0
      ) {
        throw new Error("Invalid cursor");
      }
      return { createdAt, id: parsed.id };
    } catch {
      throw new HTTPException(400, { message: ERROR_CODES.INVALID_INPUT });
    }
  }

  private getMetadataString(
    metadata: Record<string, unknown>,
    key: string,
  ): string | null {
    return typeof metadata[key] === "string" ? metadata[key] : null;
  }

  private getMetadataNumber(
    metadata: Record<string, unknown>,
    key: string,
  ): number | null {
    return typeof metadata[key] === "number" ? metadata[key] : null;
  }

  private toInteger(value: string | number): number {
    return Math.trunc(Number(value));
  }

  private toNumber(value: string | number | null): number {
    return value === null ? 0 : Number(value);
  }

  /** 기간 선택값을 밀리초로 변환합니다. */
  private getUsagePeriodMs(
    period: AdminOpenApiUsageQueryDto["period"],
  ): number {
    if (period === ADMIN_OPENAPI_USAGE_PERIOD.LAST_24_HOURS) {
      return 24 * 60 * 60 * 1_000;
    }
    if (period === ADMIN_OPENAPI_USAGE_PERIOD.LAST_30_DAYS) {
      return 30 * 24 * 60 * 60 * 1_000;
    }
    return 7 * 24 * 60 * 60 * 1_000;
  }

  /** 합계와 건수로 0에 안전한 평균을 계산합니다. */
  private average(
    total: string | number,
    count: number,
  ): number {
    return count === 0 ? 0 : this.round(Number(total) / count);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private rethrowPlanConflict(error: unknown): never {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new HTTPException(409, {
        message: ERROR_CODES.ADMIN_PLAN_CODE_EXISTS,
      });
    }
    throw error;
  }
}

export const adminService = new AdminService();
