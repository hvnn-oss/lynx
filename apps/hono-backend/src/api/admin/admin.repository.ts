import {
  ADMIN_ROLES,
  ISSUE_STATUS,
  PRODUCT_ACCESS_CAPABILITY,
  PRODUCT_ACCESS_GRANT_STATUS,
  PRODUCT_ACCESS_SUBJECT_TYPE,
  type AdminRole,
  type ApiKeyScope,
  type ProductAccessGrantStatus,
  type WorkspaceApiKeyKind,
} from "@repo/constants";
import {
  AdminAuditLogEntity,
  AdminUserEntity,
  AgentEntity,
  EventEntity,
  FirewallViolationEntity,
  IssueEntity,
  OrganizationEntity,
  OrganizationPlanEntity,
  OrganizationUserEntity,
  OpenApiApiKeyUsageHourlyEntity,
  ProductAccessGrantEntity,
  PromptEntity,
  RunEntity,
  SessionEntity,
  UserAccountEntity,
  UserEntity,
  UserEntitlementEntity,
  WorkspaceEntity,
  WorkspaceApiKeyEntity,
  WorkspaceMembershipEntity,
} from "@repo/database";
import { Brackets, type DataSource, type SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

export interface AdminCursor {
  createdAt: Date;
  id: string;
}

export interface AuditLogFilters {
  search?: string;
  action?: string;
  targetType?: string;
  actorUserId?: string;
  workspaceId?: string;
  organizationId?: string;
  requestId?: string;
  from?: Date;
  to?: Date;
  cursor?: AdminCursor;
  limit: number;
}

export interface OrganizationFilters {
  search?: string;
  planId?: string;
  cursor?: AdminCursor;
  limit: number;
}

export interface UserFilters {
  search?: string;
  access?: "NONE" | AdminRole;
  cursor?: AdminCursor;
  limit: number;
}

export interface RawAdminUser {
  id: string;
  name: string;
  email: string;
  profileImageKey: string | null;
  adminRole: AdminRole | null;
  adminIsActive: boolean | null;
  organizationCount: string | number;
  workspaceCount: string | number;
  createdAt: Date;
}

export interface RawAdminUserOrganization {
  id: string;
  name: string;
  role: string;
  joinedAt: Date;
}

export interface RawAdminUserWorkspace {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: string;
  joinedAt: Date;
}

export interface ApiKeyFilters {
  search?: string;
  organizationId?: string;
  workspaceId?: string;
  status?: "ACTIVE" | "EXPIRED" | "REVOKED";
  kind?: WorkspaceApiKeyKind;
  cursor?: AdminCursor;
  limit: number;
}

export interface OpenApiUsageFilters {
  from: Date;
  organizationId?: string;
  workspaceId?: string;
  apiKeyId?: string;
}

export interface RawAdminApiKey {
  id: string;
  name: string;
  prefix: string;
  kind: WorkspaceApiKeyKind;
  scopes: ApiKeyScope[];
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface RawApiKeyStatusCounts {
  total: string | number;
  active: string | number;
  expired: string | number;
  revoked: string | number;
}

export interface RawOpenApiUsageSummary {
  requestCount: string | number;
  successCount: string | number;
  clientErrorCount: string | number;
  serverErrorCount: string | number;
  rateLimitedCount: string | number;
  acceptedEventCount: string | number;
  rejectedEventCount: string | number;
  requestBytes: string | number;
  responseBytes: string | number;
  totalLatencyMs: string | number;
}

export interface RawOpenApiDailyUsage {
  date: string;
  requestCount: string | number;
  errorCount: string | number;
  rateLimitedCount: string | number;
  acceptedEventCount: string | number;
}

export interface RawOpenApiEndpointUsage {
  endpoint: string;
  requestCount: string | number;
  errorCount: string | number;
  rateLimitedCount: string | number;
  totalLatencyMs: string | number;
}

export interface RawOpenApiKeyUsage {
  apiKeyId: string;
  name: string;
  prefix: string;
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  requestCount: string | number;
  errorCount: string | number;
  rateLimitedCount: string | number;
  acceptedEventCount: string | number;
  lastUsedAt: Date | null;
}

export interface RawAuditLog {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  workspaceId: string | null;
  organizationId: string | null;
  requestId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RawPlan {
  id: string;
  code: string;
  name: string;
  maxWorkspaces: number | null;
  maxMembers: number | null;
  retentionDays: number;
  monthlyEventLimit: number | null;
  includedLogCount: number | null;
  logOverageUnitPrice: string | number | null;
  features: Record<string, unknown>;
  isActive: boolean;
  organizationCount: string | number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawOrganization {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  planId: string;
  planCode: string;
  planName: string;
  planMaxWorkspaces: number | null;
  planMaxMembers: number | null;
  planRetentionDays: number;
  planMonthlyEventLimit: number | null;
  planIncludedLogCount: number | null;
  planLogOverageUnitPrice: string | number | null;
  planFeatures: Record<string, unknown>;
  planIsActive: boolean;
  workspaceCount: string | number;
  memberCount: string | number;
  storedEventCount: string | number;
  latestEventAt: Date | null;
  createdAt: Date;
}

export interface RawOrganizationWorkspace {
  id: string;
  name: string;
  memberCount: string | number;
  agentCount: string | number;
  sessionCount: string | number;
  runCount: string | number;
  eventCount: string | number;
  totalCost: string | number | null;
  latestEventAt: Date | null;
}

export interface RawOrganizationMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date;
}

export interface RawOrganizationUsage {
  eventCount: string | number;
  sessionCount: string | number;
  totalCost: string | number | null;
}

export interface RawOrganizationStoredData {
  eventCount: string | number;
  sessionCount: string | number;
  runCount: string | number;
  agentCount: string | number;
  issueCount: string | number;
  openIssueCount: string | number;
  firewallViolationCount: string | number;
  promptCount: string | number;
  firstEventAt: Date | null;
  latestEventAt: Date | null;
}

export interface RawOrganizationRecentUsage {
  eventCount24h: string | number;
  eventCount7d: string | number;
  eventCount30d: string | number;
  sessionCount7d: string | number;
  runCount7d: string | number;
  totalCost7d: string | number | null;
  totalCost30d: string | number | null;
  promptTokens30d: string | number | null;
  completionTokens30d: string | number | null;
}

export interface RawEventTypeUsage {
  eventType: string;
  eventCount: string | number;
}

export interface RawAgentUsage {
  agentId: string;
  agentName: string;
  sessionCount: string | number;
  eventCount: string | number;
  totalCost: string | number | null;
}

export interface RawDailyEventUsage {
  date: string;
  eventCount: string | number;
  totalCost: string | number | null;
}

export interface PilotParticipantFilters {
  search?: string;
  status?: ProductAccessGrantStatus;
  cursor?: AdminCursor;
  limit: number;
}

export interface RawPilotParticipant {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: ProductAccessGrantStatus;
  grantedByUserId: string | null;
  grantedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 관리자 콘솔에서 사용하는 전역 조회와 제한적인 관리 작업을 제공합니다. */
export class AdminRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  listAuditLogs(filters: AuditLogFilters): Promise<RawAuditLog[]> {
    const query = this.createAuditQuery().take(filters.limit + 1);
    this.applyAuditFilters(query, filters);
    return query.getRawMany<RawAuditLog>();
  }

  getAuditLog(auditLogId: string): Promise<RawAuditLog | undefined> {
    return this.createAuditQuery()
      .andWhere("audit.id = :auditLogId", { auditLogId })
      .getRawOne<RawAuditLog>();
  }

  /** 관리자 화면에서 노출 가능한 API Key 메타데이터만 조회합니다. */
  listApiKeys(filters: ApiKeyFilters): Promise<RawAdminApiKey[]> {
    const query = this.createApiKeyQuery().take(filters.limit + 1);
    this.applyApiKeyFilters(query, filters);
    return query.getRawMany<RawAdminApiKey>();
  }

  /** 폐기 전후 감사 기록에 사용할 API Key 메타데이터를 조회합니다. */
  getApiKey(apiKeyId: string): Promise<RawAdminApiKey | undefined> {
    return this.createApiKeyQuery()
      .andWhere("apiKey.id = :apiKeyId", { apiKeyId })
      .getRawOne<RawAdminApiKey>();
  }

  /** 이미 폐기된 키를 다시 변경하지 않도록 조건부로 폐기합니다. */
  async revokeApiKey(apiKeyId: string, revokedAt: Date): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt })
      .where("id = :apiKeyId", { apiKeyId })
      .andWhere('"revokedAt" IS NULL')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** 필터 범위에 포함되는 API Key 상태 수를 집계합니다. */
  getApiKeyStatusCounts(
    filters: Omit<OpenApiUsageFilters, "from">,
  ): Promise<RawApiKeyStatusCounts | undefined> {
    const query = this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder("apiKey")
      .innerJoin(WorkspaceEntity, "workspace", "workspace.id = apiKey.workspaceId")
      .innerJoin("workspace.organization", "organization")
      .select("COUNT(apiKey.id)", "total")
      .addSelect(
        `COUNT(apiKey.id) FILTER (
          WHERE "apiKey"."revokedAt" IS NULL
            AND ("apiKey"."expiresAt" IS NULL OR "apiKey"."expiresAt" > NOW())
        )`,
        "active",
      )
      .addSelect(
        `COUNT(apiKey.id) FILTER (
          WHERE "apiKey"."revokedAt" IS NULL
            AND "apiKey"."expiresAt" IS NOT NULL
            AND "apiKey"."expiresAt" <= NOW()
        )`,
        "expired",
      )
      .addSelect(
        `COUNT(apiKey.id) FILTER (WHERE "apiKey"."revokedAt" IS NOT NULL)`,
        "revoked",
      );
    this.applyApiKeyScopeFilters(query, filters);
    return query.getRawOne<RawApiKeyStatusCounts>();
  }

  /** 선택한 기간의 OpenAPI 전체 사용량을 합산합니다. */
  getOpenApiUsageSummary(
    filters: OpenApiUsageFilters,
  ): Promise<RawOpenApiUsageSummary | undefined> {
    const query = this.createOpenApiUsageQuery()
      .select('COALESCE(SUM(usage."requestCount"), 0)', "requestCount")
      .addSelect('COALESCE(SUM(usage."successCount"), 0)', "successCount")
      .addSelect(
        'COALESCE(SUM(usage."clientErrorCount"), 0)',
        "clientErrorCount",
      )
      .addSelect(
        'COALESCE(SUM(usage."serverErrorCount"), 0)',
        "serverErrorCount",
      )
      .addSelect(
        'COALESCE(SUM(usage."rateLimitedCount"), 0)',
        "rateLimitedCount",
      )
      .addSelect(
        'COALESCE(SUM(usage."acceptedEventCount"), 0)',
        "acceptedEventCount",
      )
      .addSelect(
        'COALESCE(SUM(usage."rejectedEventCount"), 0)',
        "rejectedEventCount",
      )
      .addSelect('COALESCE(SUM(usage."requestBytes"), 0)', "requestBytes")
      .addSelect('COALESCE(SUM(usage."responseBytes"), 0)', "responseBytes")
      .addSelect(
        'COALESCE(SUM(usage."totalLatencyMs"), 0)',
        "totalLatencyMs",
      );
    this.applyOpenApiUsageFilters(query, filters);
    return query.getRawOne<RawOpenApiUsageSummary>();
  }

  /** OpenAPI 요청량을 일 단위로 묶어 추이를 반환합니다. */
  listOpenApiDailyUsage(
    filters: OpenApiUsageFilters,
  ): Promise<RawOpenApiDailyUsage[]> {
    const query = this.createOpenApiUsageQuery()
      .select(
        `TO_CHAR(DATE_TRUNC('day', usage."bucketStartedAt"), 'YYYY-MM-DD')`,
        "date",
      )
      .addSelect('SUM(usage."requestCount")', "requestCount")
      .addSelect(
        'SUM(usage."clientErrorCount" + usage."serverErrorCount")',
        "errorCount",
      )
      .addSelect('SUM(usage."rateLimitedCount")', "rateLimitedCount")
      .addSelect('SUM(usage."acceptedEventCount")', "acceptedEventCount")
      .groupBy(`DATE_TRUNC('day', usage."bucketStartedAt")`)
      .orderBy(`DATE_TRUNC('day', usage."bucketStartedAt")`, "ASC");
    this.applyOpenApiUsageFilters(query, filters);
    return query.getRawMany<RawOpenApiDailyUsage>();
  }

  /** 요청량이 많은 OpenAPI 엔드포인트를 최대 10개 반환합니다. */
  listOpenApiEndpointUsage(
    filters: OpenApiUsageFilters,
  ): Promise<RawOpenApiEndpointUsage[]> {
    const query = this.createOpenApiUsageQuery()
      .select("usage.endpoint", "endpoint")
      .addSelect('SUM(usage."requestCount")', "requestCount")
      .addSelect(
        'SUM(usage."clientErrorCount" + usage."serverErrorCount")',
        "errorCount",
      )
      .addSelect('SUM(usage."rateLimitedCount")', "rateLimitedCount")
      .addSelect('SUM(usage."totalLatencyMs")', "totalLatencyMs")
      .groupBy("usage.endpoint")
      .orderBy('SUM(usage."requestCount")', "DESC")
      .addOrderBy("usage.endpoint", "ASC")
      .limit(10);
    this.applyOpenApiUsageFilters(query, filters);
    return query.getRawMany<RawOpenApiEndpointUsage>();
  }

  /** 요청량이 많은 API Key를 안전한 메타데이터와 함께 반환합니다. */
  listOpenApiKeyUsage(
    filters: OpenApiUsageFilters,
  ): Promise<RawOpenApiKeyUsage[]> {
    const query = this.createOpenApiUsageQuery()
      .select("apiKey.id", "apiKeyId")
      .addSelect("apiKey.name", "name")
      .addSelect("apiKey.prefix", "prefix")
      .addSelect("workspace.id", "workspaceId")
      .addSelect("workspace.name", "workspaceName")
      .addSelect("organization.id", "organizationId")
      .addSelect("organization.name", "organizationName")
      .addSelect('SUM(usage."requestCount")', "requestCount")
      .addSelect(
        'SUM(usage."clientErrorCount" + usage."serverErrorCount")',
        "errorCount",
      )
      .addSelect('SUM(usage."rateLimitedCount")', "rateLimitedCount")
      .addSelect('SUM(usage."acceptedEventCount")', "acceptedEventCount")
      .addSelect("apiKey.lastUsedAt", "lastUsedAt")
      .groupBy("apiKey.id")
      .addGroupBy("workspace.id")
      .addGroupBy("organization.id")
      .orderBy('SUM(usage."requestCount")', "DESC")
      .addOrderBy("apiKey.name", "ASC")
      .limit(10);
    this.applyOpenApiUsageFilters(query, filters);
    return query.getRawMany<RawOpenApiKeyUsage>();
  }

  async getCurrentAdmin(userId: string) {
    return this.dataSource
      .getRepository(AdminUserEntity)
      .createQueryBuilder("admin")
      .innerJoin("admin.user", "user")
      .select("admin.id", "id")
      .addSelect("admin.role", "role")
      .addSelect("user.name", "name")
      .addSelect("user.email", "email")
      .where("user.id = :userId", { userId })
      .andWhere("admin.isActive = true")
      .getRawOne<{
        id: string;
        role: string;
        name: string;
        email: string;
      }>();
  }

  /** 사용자 이름, 이메일 또는 ID로 운영 콘솔의 사용자 목록을 조회합니다. */
  listUsers(filters: UserFilters): Promise<RawAdminUser[]> {
    const query = this.createUserQuery().take(filters.limit + 1);
    if (filters.search) {
      query.andWhere(
        new Brackets((builder) => {
          builder
            .where("listedUser.name ILIKE :userSearch", {
              userSearch: `%${filters.search}%`,
            })
            .orWhere("listedUser.email ILIKE :userSearch", {
              userSearch: `%${filters.search}%`,
            })
            .orWhere("listedUser.id::text ILIKE :userSearch", {
              userSearch: `%${filters.search}%`,
            });
        }),
      );
    }
    if (filters.access === "NONE") {
      query.andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM admin_user "activeAdmin"
          WHERE "activeAdmin"."userId" = "listedUser"."id"
            AND "activeAdmin"."isActive" = true
        )`,
      );
    } else if (filters.access) {
      query.andWhere(
        `EXISTS (
          SELECT 1
          FROM admin_user "activeAdmin"
          WHERE "activeAdmin"."userId" = "listedUser"."id"
            AND "activeAdmin"."isActive" = true
            AND "activeAdmin"."role" = :adminRole
        )`,
        {
          adminRole: filters.access,
        },
      );
    }
    if (filters.cursor) {
      query.andWhere(
        `("listedUser"."createdAt", "listedUser"."id") < (:userCreatedAt, :userId)`,
        {
          userCreatedAt: filters.cursor.createdAt,
          userId: filters.cursor.id,
        },
      );
    }
    return query.getRawMany<RawAdminUser>();
  }

  getUser(userId: string): Promise<RawAdminUser | undefined> {
    return this.createUserQuery()
      .andWhere("listedUser.id = :userId", { userId })
      .getRawOne<RawAdminUser>();
  }

  listUserLoginProviders(userId: string): Promise<string[]> {
    return this.dataSource
      .getRepository(UserAccountEntity)
      .createQueryBuilder("account")
      .select("account.provider", "provider")
      .where('account."userId" = :userId', { userId })
      .orderBy("account.provider", "ASC")
      .getRawMany<{ provider: string }>()
      .then((rows) => [...new Set(rows.map((row) => row.provider))]);
  }

  listUserOrganizations(
    userId: string,
  ): Promise<RawAdminUserOrganization[]> {
    return this.dataSource
      .getRepository(OrganizationUserEntity)
      .createQueryBuilder("membership")
      .innerJoin("membership.organization", "organization")
      .select("organization.id", "id")
      .addSelect("organization.name", "name")
      .addSelect("membership.role", "role")
      .addSelect("membership.joinedAt", "joinedAt")
      .where('membership."userId" = :userId', { userId })
      .orderBy("organization.name", "ASC")
      .getRawMany<RawAdminUserOrganization>();
  }

  listUserWorkspaces(userId: string): Promise<RawAdminUserWorkspace[]> {
    return this.dataSource
      .getRepository(WorkspaceMembershipEntity)
      .createQueryBuilder("membership")
      .innerJoin("membership.workspace", "workspace")
      .innerJoin("workspace.organization", "organization")
      .select("workspace.id", "id")
      .addSelect("workspace.name", "name")
      .addSelect("organization.id", "organizationId")
      .addSelect("organization.name", "organizationName")
      .addSelect("membership.role", "role")
      .addSelect("membership.createdAt", "joinedAt")
      .where('membership."userId" = :userId', { userId })
      .orderBy("organization.name", "ASC")
      .addOrderBy("workspace.name", "ASC")
      .getRawMany<RawAdminUserWorkspace>();
  }

  getUserEntitlement(userId: string): Promise<UserEntitlementEntity | null> {
    return this.dataSource
      .getRepository(UserEntitlementEntity)
      .findOneBy({ userId });
  }

  getUserPilotAccess(
    userId: string,
  ): Promise<RawPilotParticipant | undefined> {
    return this.createPilotParticipantQuery()
      .andWhere("user.id = :userId", { userId })
      .getRawOne<RawPilotParticipant>();
  }

  /**
   * 기존 관리자 행은 다시 활성화하고, 처음 권한을 받는 사용자는 ADMIN으로 등록합니다.
   */
  async setUserAdminAccess(userId: string, isAdmin: boolean): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOneBy({
        id: userId,
      });
      if (!user) return false;

      const adminRepository = manager.getRepository(AdminUserEntity);
      const admin = await adminRepository.findOne({
        where: { user: { id: userId } },
        relations: { user: true },
        order: { createdAt: "DESC" },
      });
      if (admin) {
        admin.isActive = isAdmin;
        if (isAdmin) admin.role = ADMIN_ROLES.ADMIN;
        await adminRepository.save(admin);
        return true;
      }
      if (!isAdmin) return true;

      await adminRepository.save(
        adminRepository.create({
          user,
          role: ADMIN_ROLES.ADMIN,
          isActive: true,
        }),
      );
      return true;
    });
  }

  async getOverviewCounts() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const [
      organizationCount,
      activePlanCount,
      auditLogCount24h,
      workspaceCount,
    ] = await Promise.all([
      this.dataSource.getRepository(OrganizationEntity).count(),
      this.dataSource
        .getRepository(OrganizationPlanEntity)
        .countBy({ isActive: true }),
      this.dataSource
        .getRepository(AdminAuditLogEntity)
        .createQueryBuilder("audit")
        .where("audit.createdAt >= :since", { since })
        .getCount(),
      this.dataSource.getRepository(WorkspaceEntity).count(),
    ]);
    return {
      organizationCount,
      activePlanCount,
      auditLogCount24h,
      workspaceCount,
    };
  }

  getPlanDistribution() {
    return this.dataSource
      .getRepository(OrganizationPlanEntity)
      .createQueryBuilder("plan")
      .leftJoin(
        OrganizationEntity,
        "organization",
        "organization.planId = plan.id",
      )
      .select("plan.id", "planId")
      .addSelect("plan.code", "code")
      .addSelect("plan.name", "name")
      .addSelect("COUNT(organization.id)", "organizationCount")
      .groupBy("plan.id")
      .addGroupBy("plan.code")
      .addGroupBy("plan.name")
      .orderBy("COUNT(organization.id)", "DESC")
      .addOrderBy("plan.name", "ASC")
      .getRawMany<{
        planId: string;
        code: string;
        name: string;
        organizationCount: string | number;
      }>();
  }

  listPlans(): Promise<RawPlan[]> {
    return this.createPlanQuery().getRawMany<RawPlan>();
  }

  getPlan(planId: string): Promise<RawPlan | undefined> {
    return this.createPlanQuery()
      .andWhere("plan.id = :planId", { planId })
      .getRawOne<RawPlan>();
  }

  createPlan(
    input: Omit<
      OrganizationPlanEntity,
      "id" | "organizations" | "createdAt" | "updatedAt"
    >,
  ): Promise<OrganizationPlanEntity> {
    const repository = this.dataSource.getRepository(OrganizationPlanEntity);
    return repository.save(repository.create(input));
  }

  async updatePlan(
    planId: string,
    input: Partial<
      Omit<
        OrganizationPlanEntity,
        "id" | "organizations" | "createdAt" | "updatedAt"
      >
    >,
  ): Promise<boolean> {
    const repository = this.dataSource.getRepository(OrganizationPlanEntity);
    const plan = await repository.findOneBy({ id: planId });
    if (!plan) return false;
    Object.assign(plan, input);
    await repository.save(plan);
    return true;
  }

  listOrganizations(filters: OrganizationFilters): Promise<RawOrganization[]> {
    const query = this.createOrganizationQuery().take(filters.limit + 1);
    if (filters.search) {
      query.andWhere(
        new Brackets((builder) => {
          builder
            .where("organization.name ILIKE :search", {
              search: `%${filters.search}%`,
            })
            .orWhere("owner.name ILIKE :search", {
              search: `%${filters.search}%`,
            })
            .orWhere("owner.email ILIKE :search", {
              search: `%${filters.search}%`,
            });
        }),
      );
    }
    if (filters.planId) {
      query.andWhere("plan.id = :planId", { planId: filters.planId });
    }
    if (filters.cursor) {
      query.andWhere(
        `(organization."createdAt", organization.id) < (:createdAt, :id)`,
        filters.cursor,
      );
    }
    return query.getRawMany<RawOrganization>();
  }

  getOrganization(
    organizationId: string,
  ): Promise<RawOrganization | undefined> {
    return this.createOrganizationQuery()
      .andWhere("organization.id = :organizationId", { organizationId })
      .getRawOne<RawOrganization>();
  }

  listOrganizationWorkspaces(
    organizationId: string,
  ): Promise<RawOrganizationWorkspace[]> {
    return this.dataSource
      .getRepository(WorkspaceEntity)
      .createQueryBuilder("workspace")
      .select("workspace.id", "id")
      .addSelect("workspace.name", "name")
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(membership.id)")
            .from("workspace_membership", "membership")
            .where('membership."workspaceId" = workspace.id'),
        "memberCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(agent.id)")
            .from(AgentEntity, "agent")
            .where('agent."workspaceId" = workspace.id'),
        "agentCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(session.id)")
            .from(SessionEntity, "session")
            .where('session."workspaceId" = workspace.id'),
        "sessionCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(run.id)")
            .from(RunEntity, "run")
            .where('run."workspaceId" = workspace.id'),
        "runCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(event.id)")
            .from(EventEntity, "event")
            .innerJoin(
              SessionEntity,
              "eventSession",
              "eventSession.id = event.sessionId",
            )
            .where('"eventSession"."workspaceId" = "workspace"."id"'),
        "eventCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COALESCE(SUM(event.cost), 0)")
            .from(EventEntity, "event")
            .innerJoin(
              SessionEntity,
              "eventSession",
              "eventSession.id = event.sessionId",
            )
            .where('"eventSession"."workspaceId" = "workspace"."id"'),
        "totalCost",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('MAX(event."createdAt")')
            .from(EventEntity, "event")
            .innerJoin(
              SessionEntity,
              "eventSession",
              "eventSession.id = event.sessionId",
            )
            .where('"eventSession"."workspaceId" = "workspace"."id"'),
        "latestEventAt",
      )
      .where('workspace."organizationId" = :organizationId', {
        organizationId,
      })
      .orderBy("workspace.name", "ASC")
      .getRawMany<RawOrganizationWorkspace>();
  }

  listOrganizationMembers(
    organizationId: string,
  ): Promise<RawOrganizationMember[]> {
    return this.dataSource
      .getRepository(OrganizationUserEntity)
      .createQueryBuilder("membership")
      .innerJoin("membership.user", "user")
      .select("user.id", "id")
      .addSelect("user.name", "name")
      .addSelect("user.email", "email")
      .addSelect("membership.role", "role")
      .addSelect("membership.joinedAt", "joinedAt")
      .where('membership."organizationId" = :organizationId', {
        organizationId,
      })
      .orderBy("membership.joinedAt", "ASC")
      .getRawMany<RawOrganizationMember>();
  }

  async getOrganizationUsage(
    organizationId: string,
  ): Promise<RawOrganizationUsage> {
    const monthStartedAt = new Date();
    monthStartedAt.setUTCDate(1);
    monthStartedAt.setUTCHours(0, 0, 0, 0);

    const [sessionUsage, eventUsage] = await Promise.all([
      this.dataSource
        .getRepository(SessionEntity)
        .createQueryBuilder("session")
        .innerJoin(
          WorkspaceEntity,
          "workspace",
          "workspace.id = session.workspaceId",
        )
        .select("COUNT(session.id)", "sessionCount")
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .andWhere("session.startedAt >= :monthStartedAt", { monthStartedAt })
        .getRawOne<{ sessionCount: string | number }>(),
      this.dataSource
        .getRepository(EventEntity)
        .createQueryBuilder("event")
        .innerJoin(SessionEntity, "session", "session.id = event.sessionId")
        .innerJoin(
          WorkspaceEntity,
          "workspace",
          "workspace.id = session.workspaceId",
        )
        .select("COUNT(event.id)", "eventCount")
        .addSelect("COALESCE(SUM(event.cost), 0)", "totalCost")
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .andWhere("event.createdAt >= :monthStartedAt", { monthStartedAt })
        .getRawOne<{
          eventCount: string | number;
          totalCost: string | number | null;
        }>(),
    ]);

    return {
      sessionCount: sessionUsage?.sessionCount ?? 0,
      eventCount: eventUsage?.eventCount ?? 0,
      totalCost: eventUsage?.totalCost ?? 0,
    };
  }

  /** 조직에 현재 남아 있는 주요 운영 데이터의 총량을 조회합니다. */
  async getOrganizationStoredData(
    organizationId: string,
  ): Promise<RawOrganizationStoredData> {
    const [
      events,
      sessionCount,
      runCount,
      agentCount,
      issues,
      firewallViolationCount,
      promptCount,
    ] = await Promise.all([
      this.dataSource
        .getRepository(EventEntity)
        .createQueryBuilder("event")
        .innerJoin("event.session", "session")
        .innerJoin("session.workspace", "workspace")
        .select("COUNT(event.id)", "eventCount")
        .addSelect('MIN(event."createdAt")', "firstEventAt")
        .addSelect('MAX(event."createdAt")', "latestEventAt")
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .getRawOne<{
          eventCount: string | number;
          firstEventAt: Date | null;
          latestEventAt: Date | null;
        }>(),
      this.countOrganizationRows(SessionEntity, "session", organizationId),
      this.countOrganizationRows(RunEntity, "run", organizationId),
      this.countOrganizationRows(AgentEntity, "agent", organizationId),
      this.dataSource
        .getRepository(IssueEntity)
        .createQueryBuilder("issue")
        .innerJoin(
          WorkspaceEntity,
          "workspace",
          "workspace.id = issue.workspaceId",
        )
        .select("COUNT(issue.id)", "issueCount")
        .addSelect(
          `COUNT(issue.id) FILTER (WHERE issue.status IN (:...openStatuses))`,
          "openIssueCount",
        )
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .setParameter("openStatuses", [
          ISSUE_STATUS.OPEN,
          ISSUE_STATUS.INVESTIGATING,
        ])
        .getRawOne<{
          issueCount: string | number;
          openIssueCount: string | number;
        }>(),
      this.countOrganizationRows(
        FirewallViolationEntity,
        "violation",
        organizationId,
      ),
      this.dataSource
        .getRepository(PromptEntity)
        .createQueryBuilder("prompt")
        .innerJoin(
          WorkspaceEntity,
          "workspace",
          "workspace.id = prompt.workspaceId",
        )
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .andWhere('prompt."deletedAt" IS NULL')
        .getCount(),
    ]);

    return {
      eventCount: events?.eventCount ?? 0,
      sessionCount,
      runCount,
      agentCount,
      issueCount: issues?.issueCount ?? 0,
      openIssueCount: issues?.openIssueCount ?? 0,
      firewallViolationCount,
      promptCount,
      firstEventAt: events?.firstEventAt ?? null,
      latestEventAt: events?.latestEventAt ?? null,
    };
  }

  /** 최근 기간별 수집량과 비용·토큰 사용량을 한 번에 집계합니다. */
  async getOrganizationRecentUsage(
    organizationId: string,
  ): Promise<RawOrganizationRecentUsage> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
    const [events, sessions, runs] = await Promise.all([
      this.dataSource
        .getRepository(EventEntity)
        .createQueryBuilder("event")
        .innerJoin("event.session", "session")
        .innerJoin("session.workspace", "workspace")
        .select(
          'COUNT(event.id) FILTER (WHERE event."createdAt" >= :since24h)',
          "eventCount24h",
        )
        .addSelect(
          'COUNT(event.id) FILTER (WHERE event."createdAt" >= :since7d)',
          "eventCount7d",
        )
        .addSelect("COUNT(event.id)", "eventCount30d")
        .addSelect(
          'COALESCE(SUM(event.cost) FILTER (WHERE event."createdAt" >= :since7d), 0)',
          "totalCost7d",
        )
        .addSelect("COALESCE(SUM(event.cost), 0)", "totalCost30d")
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .andWhere('event."createdAt" >= :since30d', { since30d })
        .setParameters({ since24h, since7d })
        .getRawOne<{
          eventCount24h: string | number;
          eventCount7d: string | number;
          eventCount30d: string | number;
          totalCost7d: string | number | null;
          totalCost30d: string | number | null;
        }>(),
      this.dataSource
        .getRepository(SessionEntity)
        .createQueryBuilder("session")
        .innerJoin("session.workspace", "workspace")
        .select(
          'COUNT(session.id) FILTER (WHERE session."startedAt" >= :since7d)',
          "sessionCount7d",
        )
        .addSelect(
          'COALESCE(SUM(session."totalPromptTokens"), 0)',
          "promptTokens30d",
        )
        .addSelect(
          'COALESCE(SUM(session."totalCompletionTokens"), 0)',
          "completionTokens30d",
        )
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .andWhere('session."startedAt" >= :since30d', { since30d })
        .setParameter("since7d", since7d)
        .getRawOne<{
          sessionCount7d: string | number;
          promptTokens30d: string | number | null;
          completionTokens30d: string | number | null;
        }>(),
      this.dataSource
        .getRepository(RunEntity)
        .createQueryBuilder("run")
        .innerJoin(
          WorkspaceEntity,
          "workspace",
          "workspace.id = run.workspaceId",
        )
        .where('workspace."organizationId" = :organizationId', {
          organizationId,
        })
        .andWhere('run."startedAt" >= :since7d', { since7d })
        .getCount(),
    ]);
    return {
      eventCount24h: events?.eventCount24h ?? 0,
      eventCount7d: events?.eventCount7d ?? 0,
      eventCount30d: events?.eventCount30d ?? 0,
      totalCost7d: events?.totalCost7d ?? 0,
      totalCost30d: events?.totalCost30d ?? 0,
      sessionCount7d: sessions?.sessionCount7d ?? 0,
      promptTokens30d: sessions?.promptTokens30d ?? 0,
      completionTokens30d: sessions?.completionTokens30d ?? 0,
      runCount7d: runs,
    };
  }

  listOrganizationEventTypes(
    organizationId: string,
  ): Promise<RawEventTypeUsage[]> {
    return this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder("event")
      .innerJoin("event.session", "session")
      .innerJoin("session.workspace", "workspace")
      .select('event."eventType"', "eventType")
      .addSelect("COUNT(event.id)", "eventCount")
      .where('workspace."organizationId" = :organizationId', {
        organizationId,
      })
      .groupBy('event."eventType"')
      .orderBy("COUNT(event.id)", "DESC")
      .limit(10)
      .getRawMany<RawEventTypeUsage>();
  }

  listOrganizationAgentUsage(organizationId: string): Promise<RawAgentUsage[]> {
    return this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder("event")
      .innerJoin("event.session", "session")
      .innerJoin("session.agent", "agent")
      .innerJoin("session.workspace", "workspace")
      .select("agent.id", "agentId")
      .addSelect("agent.name", "agentName")
      .addSelect("COUNT(DISTINCT session.id)", "sessionCount")
      .addSelect("COUNT(event.id)", "eventCount")
      .addSelect("COALESCE(SUM(event.cost), 0)", "totalCost")
      .where('workspace."organizationId" = :organizationId', {
        organizationId,
      })
      .groupBy("agent.id")
      .addGroupBy("agent.name")
      .orderBy("COUNT(event.id)", "DESC")
      .limit(10)
      .getRawMany<RawAgentUsage>();
  }

  listOrganizationDailyEventTrend(
    organizationId: string,
  ): Promise<RawDailyEventUsage[]> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000);
    return this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder("event")
      .innerJoin("event.session", "session")
      .innerJoin("session.workspace", "workspace")
      .select(
        `TO_CHAR(DATE_TRUNC('day', event."createdAt"), 'YYYY-MM-DD')`,
        "date",
      )
      .addSelect("COUNT(event.id)", "eventCount")
      .addSelect("COALESCE(SUM(event.cost), 0)", "totalCost")
      .where('workspace."organizationId" = :organizationId', {
        organizationId,
      })
      .andWhere('event."createdAt" >= :since', { since })
      .groupBy(`DATE_TRUNC('day', event."createdAt")`)
      .orderBy(`DATE_TRUNC('day', event."createdAt")`, "ASC")
      .getRawMany<RawDailyEventUsage>();
  }

  listPilotParticipants(
    filters: PilotParticipantFilters,
  ): Promise<RawPilotParticipant[]> {
    const query = this.createPilotParticipantQuery().take(filters.limit + 1);
    if (filters.search) {
      query.andWhere(
        new Brackets((builder) => {
          builder
            .where("user.name ILIKE :participantSearch", {
              participantSearch: `%${filters.search}%`,
            })
            .orWhere("user.email ILIKE :participantSearch", {
              participantSearch: `%${filters.search}%`,
            });
        }),
      );
    }
    if (filters.status) {
      query.andWhere(
        `${this.getPilotStatusExpression()} = :participantStatus`,
        { participantStatus: filters.status },
      );
    }
    if (filters.cursor) {
      query.andWhere(
        `("accessGrant"."createdAt", "accessGrant"."id") < (:participantCreatedAt, :participantId)`,
        {
          participantCreatedAt: filters.cursor.createdAt,
          participantId: filters.cursor.id,
        },
      );
    }
    return query.getRawMany<RawPilotParticipant>();
  }

  getPilotParticipant(
    participantId: string,
  ): Promise<RawPilotParticipant | undefined> {
    return this.createPilotParticipantQuery()
      .andWhere('"accessGrant"."id" = :participantId', { participantId })
      .getRawOne<RawPilotParticipant>();
  }

  async updatePilotParticipant(
    participantId: string,
    input: {
      status: ProductAccessGrantStatus;
      expiresAt?: Date | null;
    },
  ): Promise<boolean> {
    const repository = this.dataSource.getRepository(ProductAccessGrantEntity);
    const grant = await repository.findOneBy({
      id: participantId,
      subjectType: PRODUCT_ACCESS_SUBJECT_TYPE.USER,
      capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
    });
    if (!grant) return false;
    grant.status = input.status;
    if (input.expiresAt !== undefined) grant.expiresAt = input.expiresAt;
    await repository.save(grant);
    return true;
  }

  async updateOrganizationPlan(
    organizationId: string,
    planId: string,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OrganizationEntity);
      // eager 관계를 JOIN하지 않고 조직 행만 잠가 PostgreSQL의 outer join 잠금 오류를 피합니다.
      const organization = await repository
        .createQueryBuilder("organization")
        .setLock("pessimistic_write", undefined, ["organization"])
        .where("organization.id = :organizationId", { organizationId })
        .getOne();
      if (!organization) return false;
      organization.planId = planId;
      await repository.save(organization);
      return true;
    });
  }

  /** API Key 원문과 해시는 선택하지 않고 운영 메타데이터만 구성합니다. */
  /** 비밀번호나 외부 계정 식별자를 포함하지 않는 사용자 운영 메타데이터만 선택합니다. */
  private createUserQuery(): SelectQueryBuilder<UserEntity> {
    return this.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder("listedUser")
      .select("listedUser.id", "id")
      .addSelect("listedUser.name", "name")
      .addSelect("listedUser.email", "email")
      .addSelect("listedUser.profileImageKey", "profileImageKey")
      .addSelect(
        (subquery) =>
          subquery
            .select("adminAccess.role")
            .from(AdminUserEntity, "adminAccess")
            .where('"adminAccess"."userId" = "listedUser"."id"')
            .orderBy("adminAccess.isActive", "DESC")
            .addOrderBy("adminAccess.createdAt", "DESC")
            .limit(1),
        "adminRole",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("adminAccess.isActive")
            .from(AdminUserEntity, "adminAccess")
            .where('"adminAccess"."userId" = "listedUser"."id"')
            .orderBy("adminAccess.isActive", "DESC")
            .addOrderBy("adminAccess.createdAt", "DESC")
            .limit(1),
        "adminIsActive",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(organizationMembership.id)")
            .from(OrganizationUserEntity, "organizationMembership")
            .where(
              '"organizationMembership"."userId" = "listedUser"."id"',
            ),
        "organizationCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(workspaceMembership.id)")
            .from(WorkspaceMembershipEntity, "workspaceMembership")
            .where('"workspaceMembership"."userId" = "listedUser"."id"'),
        "workspaceCount",
      )
      .addSelect("listedUser.createdAt", "createdAt")
      .orderBy("listedUser.createdAt", "DESC")
      .addOrderBy("listedUser.id", "DESC");
  }

  private createApiKeyQuery(): SelectQueryBuilder<WorkspaceApiKeyEntity> {
    return this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder("apiKey")
      .innerJoin(WorkspaceEntity, "workspace", "workspace.id = apiKey.workspaceId")
      .innerJoin("workspace.organization", "organization")
      .leftJoin(UserEntity, "createdBy", "createdBy.id = apiKey.createdByUserId")
      .select("apiKey.id", "id")
      .addSelect("apiKey.name", "name")
      .addSelect("apiKey.prefix", "prefix")
      .addSelect("apiKey.kind", "kind")
      .addSelect("apiKey.scopes", "scopes")
      .addSelect("workspace.id", "workspaceId")
      .addSelect("workspace.name", "workspaceName")
      .addSelect("organization.id", "organizationId")
      .addSelect("organization.name", "organizationName")
      .addSelect("apiKey.createdByUserId", "createdByUserId")
      .addSelect(
        'COALESCE("createdBy"."name", "apiKey"."createdByName")',
        "createdByName",
      )
      .addSelect("apiKey.createdAt", "createdAt")
      .addSelect("apiKey.lastUsedAt", "lastUsedAt")
      .addSelect("apiKey.expiresAt", "expiresAt")
      .addSelect("apiKey.revokedAt", "revokedAt")
      .orderBy("apiKey.createdAt", "DESC")
      .addOrderBy("apiKey.id", "DESC");
  }

  /** API Key 목록의 검색, 범위, 상태와 커서 조건을 적용합니다. */
  private applyApiKeyFilters(
    query: SelectQueryBuilder<WorkspaceApiKeyEntity>,
    filters: ApiKeyFilters,
  ): void {
    if (filters.search) {
      query.andWhere(
        new Brackets((builder) => {
          builder
            .where("apiKey.name ILIKE :apiKeySearch", {
              apiKeySearch: `%${filters.search}%`,
            })
            .orWhere("apiKey.prefix ILIKE :apiKeySearch", {
              apiKeySearch: `%${filters.search}%`,
            })
            .orWhere("workspace.name ILIKE :apiKeySearch", {
              apiKeySearch: `%${filters.search}%`,
            })
            .orWhere("organization.name ILIKE :apiKeySearch", {
              apiKeySearch: `%${filters.search}%`,
            });
        }),
      );
    }
    this.applyApiKeyScopeFilters(query, filters);
    if (filters.kind) {
      query.andWhere("apiKey.kind = :apiKeyKind", {
        apiKeyKind: filters.kind,
      });
    }
    if (filters.status === "ACTIVE") {
      query
        .andWhere('"apiKey"."revokedAt" IS NULL')
        .andWhere(
          '("apiKey"."expiresAt" IS NULL OR "apiKey"."expiresAt" > NOW())',
        );
    }
    if (filters.status === "EXPIRED") {
      query
        .andWhere('"apiKey"."revokedAt" IS NULL')
        .andWhere('"apiKey"."expiresAt" IS NOT NULL')
        .andWhere('"apiKey"."expiresAt" <= NOW()');
    }
    if (filters.status === "REVOKED") {
      query.andWhere('"apiKey"."revokedAt" IS NOT NULL');
    }
    if (filters.cursor) {
      query.andWhere(
        `("apiKey"."createdAt", "apiKey"."id") < (:apiKeyCreatedAt, :apiKeyCursorId)`,
        {
          apiKeyCreatedAt: filters.cursor.createdAt,
          apiKeyCursorId: filters.cursor.id,
        },
      );
    }
  }

  /** API Key가 속한 조직과 워크스페이스 범위를 제한합니다. */
  private applyApiKeyScopeFilters(
    query: SelectQueryBuilder<WorkspaceApiKeyEntity>,
    filters: {
      organizationId?: string;
      workspaceId?: string;
      apiKeyId?: string;
    },
  ): void {
    if (filters.organizationId) {
      query.andWhere("organization.id = :apiKeyOrganizationId", {
        apiKeyOrganizationId: filters.organizationId,
      });
    }
    if (filters.workspaceId) {
      query.andWhere("workspace.id = :apiKeyWorkspaceId", {
        apiKeyWorkspaceId: filters.workspaceId,
      });
    }
    if (filters.apiKeyId) {
      query.andWhere("apiKey.id = :filteredApiKeyId", {
        filteredApiKeyId: filters.apiKeyId,
      });
    }
  }

  /** 사용량 집계와 키·워크스페이스·조직을 연결한 기본 쿼리를 생성합니다. */
  private createOpenApiUsageQuery(): SelectQueryBuilder<OpenApiApiKeyUsageHourlyEntity> {
    return this.dataSource
      .getRepository(OpenApiApiKeyUsageHourlyEntity)
      .createQueryBuilder("usage")
      .innerJoin(
        WorkspaceApiKeyEntity,
        "apiKey",
        "apiKey.id = usage.apiKeyId",
      )
      .innerJoin(WorkspaceEntity, "workspace", "workspace.id = usage.workspaceId")
      .innerJoin("workspace.organization", "organization");
  }

  /** 모든 사용량 조회에 동일한 기간과 소유 범위 필터를 적용합니다. */
  private applyOpenApiUsageFilters(
    query: SelectQueryBuilder<OpenApiApiKeyUsageHourlyEntity>,
    filters: OpenApiUsageFilters,
  ): void {
    query.andWhere('usage."bucketStartedAt" >= :usageFrom', {
      usageFrom: filters.from,
    });
    if (filters.organizationId) {
      query.andWhere("organization.id = :usageOrganizationId", {
        usageOrganizationId: filters.organizationId,
      });
    }
    if (filters.workspaceId) {
      query.andWhere("workspace.id = :usageWorkspaceId", {
        usageWorkspaceId: filters.workspaceId,
      });
    }
    if (filters.apiKeyId) {
      query.andWhere("apiKey.id = :usageApiKeyId", {
        usageApiKeyId: filters.apiKeyId,
      });
    }
  }

  private createAuditQuery(): SelectQueryBuilder<AdminAuditLogEntity> {
    return this.dataSource
      .getRepository(AdminAuditLogEntity)
      .createQueryBuilder("audit")
      .leftJoin(UserEntity, "actor", "actor.id::text = audit.actorUserId")
      .select("audit.id", "id")
      .addSelect("audit.actorUserId", "actorUserId")
      .addSelect("actor.name", "actorName")
      .addSelect("actor.email", "actorEmail")
      .addSelect("audit.action", "action")
      .addSelect("audit.targetType", "targetType")
      .addSelect("audit.targetId", "targetId")
      .addSelect("audit.workspaceId", "workspaceId")
      .addSelect("audit.organizationId", "organizationId")
      .addSelect("audit.requestId", "requestId")
      .addSelect("audit.before", "before")
      .addSelect("audit.after", "after")
      .addSelect("audit.metadata", "metadata")
      .addSelect("audit.createdAt", "createdAt")
      .orderBy("audit.createdAt", "DESC")
      .addOrderBy("audit.id", "DESC");
  }

  private createPilotParticipantQuery(): SelectQueryBuilder<ProductAccessGrantEntity> {
    return this.dataSource
      .getRepository(ProductAccessGrantEntity)
      .createQueryBuilder("accessGrant")
      .innerJoin(UserEntity, "user", "user.id = accessGrant.subjectId")
      .select("accessGrant.id", "id")
      .addSelect("user.id", "userId")
      .addSelect("user.name", "userName")
      .addSelect("user.email", "userEmail")
      .addSelect(this.getPilotStatusExpression(), "status")
      .addSelect("accessGrant.grantedByUserId", "grantedByUserId")
      .addSelect("accessGrant.grantedAt", "grantedAt")
      .addSelect("accessGrant.expiresAt", "expiresAt")
      .addSelect("accessGrant.createdAt", "createdAt")
      .addSelect("accessGrant.updatedAt", "updatedAt")
      .where("accessGrant.subjectType = :participantSubjectType", {
        participantSubjectType: PRODUCT_ACCESS_SUBJECT_TYPE.USER,
      })
      .andWhere("accessGrant.capability = :participantCapability", {
        participantCapability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
      })
      .orderBy("accessGrant.createdAt", "DESC")
      .addOrderBy("accessGrant.id", "DESC");
  }

  private getPilotStatusExpression(): string {
    return `CASE
      WHEN "accessGrant"."status" = '${PRODUCT_ACCESS_GRANT_STATUS.SUSPENDED}'
        THEN '${PRODUCT_ACCESS_GRANT_STATUS.SUSPENDED}'
      WHEN "accessGrant"."status" = '${PRODUCT_ACCESS_GRANT_STATUS.EXPIRED}'
        OR (
          "accessGrant"."expiresAt" IS NOT NULL
          AND "accessGrant"."expiresAt" <= NOW()
        )
        THEN '${PRODUCT_ACCESS_GRANT_STATUS.EXPIRED}'
      ELSE '${PRODUCT_ACCESS_GRANT_STATUS.ACTIVE}'
    END`;
  }

  private countOrganizationRows(
    entity:
      | typeof SessionEntity
      | typeof RunEntity
      | typeof AgentEntity
      | typeof FirewallViolationEntity,
    alias: string,
    organizationId: string,
  ): Promise<number> {
    return this.dataSource
      .getRepository(entity)
      .createQueryBuilder(alias)
      .innerJoin(
        WorkspaceEntity,
        "countWorkspace",
        `countWorkspace.id = ${alias}."workspaceId"`,
      )
      .where('"countWorkspace"."organizationId" = :organizationId', {
        organizationId,
      })
      .getCount();
  }

  private applyAuditFilters(
    query: SelectQueryBuilder<AdminAuditLogEntity>,
    filters: AuditLogFilters,
  ): void {
    if (filters.search) {
      query.andWhere(
        new Brackets((builder) => {
          builder
            .where("audit.action ILIKE :search", {
              search: `%${filters.search}%`,
            })
            .orWhere("audit.targetType ILIKE :search", {
              search: `%${filters.search}%`,
            })
            .orWhere("audit.targetId ILIKE :search", {
              search: `%${filters.search}%`,
            })
            .orWhere("actor.name ILIKE :search", {
              search: `%${filters.search}%`,
            })
            .orWhere("actor.email ILIKE :search", {
              search: `%${filters.search}%`,
            });
        }),
      );
    }
    if (filters.action)
      query.andWhere("audit.action = :action", { action: filters.action });
    if (filters.targetType) {
      query.andWhere("audit.targetType = :targetType", {
        targetType: filters.targetType,
      });
    }
    if (filters.actorUserId) {
      query.andWhere("audit.actorUserId = :actorUserId", {
        actorUserId: filters.actorUserId,
      });
    }
    if (filters.workspaceId) {
      query.andWhere("audit.workspaceId = :workspaceId", {
        workspaceId: filters.workspaceId,
      });
    }
    if (filters.organizationId) {
      query.andWhere("audit.organizationId = :organizationId", {
        organizationId: filters.organizationId,
      });
    }
    if (filters.requestId) {
      query.andWhere("audit.requestId = :requestId", {
        requestId: filters.requestId,
      });
    }
    if (filters.from)
      query.andWhere("audit.createdAt >= :from", { from: filters.from });
    if (filters.to)
      query.andWhere("audit.createdAt <= :to", { to: filters.to });
    if (filters.cursor) {
      query.andWhere(`(audit."createdAt", audit.id) < (:createdAt, :id)`, {
        createdAt: filters.cursor.createdAt,
        id: filters.cursor.id,
      });
    }
  }

  private createPlanQuery(): SelectQueryBuilder<OrganizationPlanEntity> {
    return this.dataSource
      .getRepository(OrganizationPlanEntity)
      .createQueryBuilder("plan")
      .leftJoin(
        OrganizationEntity,
        "organization",
        "organization.planId = plan.id",
      )
      .select("plan.id", "id")
      .addSelect("plan.code", "code")
      .addSelect("plan.name", "name")
      .addSelect("plan.maxWorkspaces", "maxWorkspaces")
      .addSelect("plan.maxMembers", "maxMembers")
      .addSelect("plan.retentionDays", "retentionDays")
      .addSelect("plan.monthlyEventLimit", "monthlyEventLimit")
      .addSelect("plan.includedLogCount", "includedLogCount")
      .addSelect("plan.logOverageUnitPrice", "logOverageUnitPrice")
      .addSelect("plan.features", "features")
      .addSelect("plan.isActive", "isActive")
      .addSelect("plan.createdAt", "createdAt")
      .addSelect("plan.updatedAt", "updatedAt")
      .addSelect("COUNT(organization.id)", "organizationCount")
      .groupBy("plan.id")
      .orderBy("plan.isActive", "DESC")
      .addOrderBy("plan.name", "ASC");
  }

  private createOrganizationQuery(): SelectQueryBuilder<OrganizationEntity> {
    return this.dataSource
      .getRepository(OrganizationEntity)
      .createQueryBuilder("organization")
      .innerJoin("organization.plan", "plan")
      .innerJoin(UserEntity, "owner", "owner.id = organization.ownerUserId")
      .select("organization.id", "id")
      .addSelect("organization.name", "name")
      .addSelect("organization.createdAt", "createdAt")
      .addSelect("owner.id", "ownerId")
      .addSelect("owner.name", "ownerName")
      .addSelect("owner.email", "ownerEmail")
      .addSelect("plan.id", "planId")
      .addSelect("plan.code", "planCode")
      .addSelect("plan.name", "planName")
      .addSelect("plan.maxWorkspaces", "planMaxWorkspaces")
      .addSelect("plan.maxMembers", "planMaxMembers")
      .addSelect("plan.retentionDays", "planRetentionDays")
      .addSelect("plan.monthlyEventLimit", "planMonthlyEventLimit")
      .addSelect("plan.includedLogCount", "planIncludedLogCount")
      .addSelect("plan.logOverageUnitPrice", "planLogOverageUnitPrice")
      .addSelect("plan.features", "planFeatures")
      .addSelect("plan.isActive", "planIsActive")
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(workspace.id)")
            .from(WorkspaceEntity, "workspace")
            .where('workspace."organizationId" = organization.id'),
        "workspaceCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(membership.id)")
            .from(OrganizationUserEntity, "membership")
            .where('membership."organizationId" = organization.id'),
        "memberCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select("COUNT(organizationEvent.id)")
            .from(EventEntity, "organizationEvent")
            .innerJoin(
              SessionEntity,
              "organizationSession",
              "organizationSession.id = organizationEvent.sessionId",
            )
            .innerJoin(
              WorkspaceEntity,
              "eventWorkspace",
              "eventWorkspace.id = organizationSession.workspaceId",
            )
            .where('"eventWorkspace"."organizationId" = "organization"."id"'),
        "storedEventCount",
      )
      .addSelect(
        (subquery) =>
          subquery
            .select('MAX("organizationEvent"."createdAt")')
            .from(EventEntity, "organizationEvent")
            .innerJoin(
              SessionEntity,
              "organizationSession",
              "organizationSession.id = organizationEvent.sessionId",
            )
            .innerJoin(
              WorkspaceEntity,
              "eventWorkspace",
              "eventWorkspace.id = organizationSession.workspaceId",
            )
            .where('"eventWorkspace"."organizationId" = "organization"."id"'),
        "latestEventAt",
      )
      .orderBy("organization.createdAt", "DESC")
      .addOrderBy("organization.id", "DESC");
  }
}

export const adminRepository = new AdminRepository();
