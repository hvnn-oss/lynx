import { ERROR_CODES } from "@repo/constants";
import type { AuditLogRecorder } from "../../common/services/audit-log.service.js";
import {
  AdminRepository,
  type RawAdminApiKey,
  type RawAdminUser,
  type RawAuditLog,
  type RawOrganization,
  type RawPilotParticipant,
  type RawPlan,
} from "./admin.repository.js";
import { AdminService } from "./admin.service.js";

const auditId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-000000000002";
const actorId = "00000000-0000-4000-8000-000000000003";

function auditRow(): RawAuditLog {
  return {
    id: auditId,
    actorUserId: actorId,
    actorName: "Lynx Admin",
    actorEmail: "admin@lynx.local",
    action: "organization_plan.update",
    targetType: "organization_plan",
    targetId: planId,
    workspaceId: null,
    organizationId: null,
    requestId: "request-1",
    before: { name: "Pilot" },
    after: { name: "Pilot Plus" },
    metadata: {
      method: "PATCH",
      path: `/admin/plans/${planId}`,
      statusCode: 200,
      request: { body: { name: "Pilot Plus" } },
      response: { body: { id: planId } },
    },
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
  };
}

function planRow(overrides: Partial<RawPlan> = {}): RawPlan {
  return {
    id: planId,
    code: "PILOT",
    name: "Pilot",
    maxWorkspaces: 3,
    maxMembers: 10,
    retentionDays: 30,
    monthlyEventLimit: 100_000,
    includedLogCount: 100_000,
    logOverageUnitPrice: "0.000100",
    features: { advancedDebug: true },
    isActive: true,
    organizationCount: "2",
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
    ...overrides,
  };
}

function organizationRow(): RawOrganization {
  return {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Acme",
    ownerId: actorId,
    ownerName: "Owner",
    ownerEmail: "owner@acme.test",
    planId,
    planCode: "PILOT",
    planName: "Pilot",
    planMaxWorkspaces: 3,
    planMaxMembers: 10,
    planRetentionDays: 30,
    planMonthlyEventLimit: 100_000,
    planIncludedLogCount: 100_000,
    planLogOverageUnitPrice: "0.0001",
    planFeatures: {},
    planIsActive: true,
    workspaceCount: "1",
    memberCount: "1",
    storedEventCount: "20",
    latestEventAt: new Date("2026-07-29T01:00:00.000Z"),
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
  };
}

function participantRow(
  status: RawPilotParticipant["status"] = "ACTIVE",
): RawPilotParticipant {
  return {
    id: "00000000-0000-4000-8000-000000000005",
    userId: actorId,
    userName: "Pilot User",
    userEmail: "pilot@lynx.local",
    status,
    grantedByUserId: null,
    grantedAt: new Date("2026-07-29T00:00:00.000Z"),
    expiresAt: null,
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
  };
}

function apiKeyRow(overrides: Partial<RawAdminApiKey> = {}): RawAdminApiKey {
  return {
    id: "00000000-0000-4000-8000-000000000007",
    name: "Production SDK",
    prefix: "lynx_production",
    kind: "SDK",
    scopes: ["events:write"],
    workspaceId: "00000000-0000-4000-8000-000000000008",
    workspaceName: "Production",
    organizationId: "00000000-0000-4000-8000-000000000004",
    organizationName: "Acme",
    createdByUserId: actorId,
    createdByName: "Owner",
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
    lastUsedAt: new Date("2026-07-29T01:00:00.000Z"),
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function userRow(overrides: Partial<RawAdminUser> = {}): RawAdminUser {
  return {
    id: "00000000-0000-4000-8000-000000000009",
    name: "Test User",
    email: "user@lynx.local",
    profileImageKey: null,
    adminRole: null,
    adminIsActive: null,
    organizationCount: "2",
    workspaceCount: "3",
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
    ...overrides,
  };
}

function createService() {
  const repository = {
    getCurrentAdmin: jest.fn(),
    getOverviewCounts: jest.fn(),
    getPlanDistribution: jest.fn(),
    listAuditLogs: jest.fn(),
    getAuditLog: jest.fn(),
    listApiKeys: jest.fn(),
    getApiKey: jest.fn(),
    revokeApiKey: jest.fn(),
    getApiKeyStatusCounts: jest.fn(),
    getOpenApiUsageSummary: jest.fn(),
    listOpenApiDailyUsage: jest.fn(),
    listOpenApiEndpointUsage: jest.fn(),
    listOpenApiKeyUsage: jest.fn(),
    listPlans: jest.fn(),
    getPlan: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    listOrganizations: jest.fn(),
    getOrganization: jest.fn(),
    listOrganizationWorkspaces: jest.fn(),
    listOrganizationMembers: jest.fn(),
    getOrganizationUsage: jest.fn(),
    getOrganizationStoredData: jest.fn(),
    getOrganizationRecentUsage: jest.fn(),
    listOrganizationEventTypes: jest.fn(),
    listOrganizationAgentUsage: jest.fn(),
    listOrganizationDailyEventTrend: jest.fn(),
    updateOrganizationPlan: jest.fn(),
    listUsers: jest.fn(),
    getUser: jest.fn(),
    listUserLoginProviders: jest.fn().mockResolvedValue([]),
    listUserOrganizations: jest.fn().mockResolvedValue([]),
    listUserWorkspaces: jest.fn().mockResolvedValue([]),
    getUserEntitlement: jest.fn().mockResolvedValue(null),
    getUserPilotAccess: jest.fn().mockResolvedValue(undefined),
    setUserAdminRole: jest.fn(),
    deleteNonAdminUser: jest.fn(),
    listPilotParticipants: jest.fn(),
    getPilotParticipant: jest.fn(),
    updatePilotParticipant: jest.fn(),
  };
  const recorder: AuditLogRecorder = { record: jest.fn() };
  return {
    service: new AdminService(
      repository as unknown as AdminRepository,
      recorder,
    ),
    repository,
    recorder,
  };
}

describe("AdminService", () => {
  it("API Key 목록에서 비밀값 없이 상태와 소유 범위를 반환한다", async () => {
    const { service, repository } = createService();
    repository.listApiKeys.mockResolvedValue([apiKeyRow()]);

    const result = await service.listApiKeys({ limit: 25 });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          name: "Production SDK",
          prefix: "lynx_production",
          status: "ACTIVE",
          workspace: expect.objectContaining({ name: "Production" }),
          organization: expect.objectContaining({ name: "Acme" }),
        }),
      ],
      nextCursor: null,
    });
    expect(result.items[0]).not.toHaveProperty("keyHash");
  });

  it("OpenAPI 사용량 문자열 집계를 안전한 숫자와 평균으로 변환한다", async () => {
    const { service, repository } = createService();
    repository.getApiKeyStatusCounts.mockResolvedValue({
      total: "3",
      active: "2",
      expired: "0",
      revoked: "1",
    });
    repository.getOpenApiUsageSummary.mockResolvedValue({
      requestCount: "10",
      successCount: "8",
      clientErrorCount: "1",
      serverErrorCount: "1",
      rateLimitedCount: "1",
      acceptedEventCount: "22",
      rejectedEventCount: "2",
      requestBytes: "1024",
      responseBytes: "2048",
      totalLatencyMs: "125",
    });
    repository.listOpenApiDailyUsage.mockResolvedValue([
      {
        date: "2026-07-29",
        requestCount: "10",
        errorCount: "2",
        rateLimitedCount: "1",
        acceptedEventCount: "22",
      },
    ]);
    repository.listOpenApiEndpointUsage.mockResolvedValue([
      {
        endpoint: "POST /openapi/v1/events",
        requestCount: "10",
        errorCount: "2",
        rateLimitedCount: "1",
        totalLatencyMs: "125",
      },
    ]);
    repository.listOpenApiKeyUsage.mockResolvedValue([
      {
        apiKeyId: apiKeyRow().id,
        name: "Production SDK",
        prefix: "lynx_production",
        workspaceId: apiKeyRow().workspaceId,
        workspaceName: "Production",
        organizationId: apiKeyRow().organizationId,
        organizationName: "Acme",
        requestCount: "10",
        errorCount: "2",
        rateLimitedCount: "1",
        acceptedEventCount: "22",
        lastUsedAt: new Date("2026-07-29T01:00:00.000Z"),
      },
    ]);

    const result = await service.getOpenApiUsage({ period: "7d" });

    expect(result.summary).toEqual(
      expect.objectContaining({
        requestCount: 10,
        acceptedEventCount: 22,
        averageLatencyMs: 12.5,
        successRate: 80,
      }),
    );
    expect(result.keyStatus).toEqual({
      total: 3,
      active: 2,
      expired: 0,
      revoked: 1,
    });
    expect(result.endpoints[0]?.averageLatencyMs).toBe(12.5);
  });

  it("API Key를 폐기하고 키 원문이 없는 감사 기록을 남긴다", async () => {
    const { service, repository, recorder } = createService();
    repository.getApiKey
      .mockResolvedValueOnce(apiKeyRow())
      .mockResolvedValueOnce(apiKeyRow({ revokedAt: new Date() }));
    repository.revokeApiKey.mockResolvedValue(true);

    const result = await service.revokeApiKey(
      actorId,
      apiKeyRow().id,
      "request-1",
    );

    expect(result.status).toBe("REVOKED");
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "workspace_api_key.admin_revoke",
        targetId: apiKeyRow().id,
        workspaceId: apiKeyRow().workspaceId,
        organizationId: apiKeyRow().organizationId,
      }),
    );
    expect(recorder.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ keyHash: expect.anything() }),
    );
  });

  it("요약 화면에 관리자와 최근 감사 기록을 사람이 읽을 수 있는 형태로 반환한다", async () => {
    const { service, repository } = createService();
    repository.getCurrentAdmin.mockResolvedValue({
      id: actorId,
      name: "Lynx Admin",
      email: "admin@lynx.local",
      role: "SUPER_ADMIN",
    });
    repository.getOverviewCounts.mockResolvedValue({
      organizationCount: 4,
      activePlanCount: 3,
      auditLogCount24h: 8,
      workspaceCount: 7,
    });
    repository.getPlanDistribution.mockResolvedValue([
      {
        planId,
        code: "PILOT",
        name: "Pilot",
        organizationCount: "2",
      },
    ]);
    repository.listAuditLogs.mockResolvedValue(
      Array.from({ length: 6 }, () => auditRow()),
    );

    const result = await service.getOverview(actorId);

    expect(result.metrics.organizationCount).toBe(4);
    expect(result.planDistribution[0]?.organizationCount).toBe(2);
    expect(result.recentAuditLogs).toHaveLength(5);
    expect(repository.listAuditLogs).toHaveBeenCalledWith({ limit: 5 });
    expect(result.recentAuditLogs[0]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        statusCode: 200,
        hasPayload: true,
      }),
    );
  });

  it("감사 상세에서 요청·응답과 변경 전후 데이터를 분리한다", async () => {
    const { service, repository } = createService();
    repository.getAuditLog.mockResolvedValue(auditRow());

    const result = await service.getAuditLog(auditId);

    expect(result.before).toEqual({ name: "Pilot" });
    expect(result.after).toEqual({ name: "Pilot Plus" });
    expect(result.requestData).toEqual({
      body: { name: "Pilot Plus" },
    });
    expect(result.responseData).toEqual({ body: { id: planId } });
  });

  it("새 요금제를 저장하고 전체 변경 데이터를 감사 기록에 남긴다", async () => {
    const { service, repository, recorder } = createService();
    repository.createPlan.mockResolvedValue({ id: planId });
    repository.getPlan.mockResolvedValue(planRow());

    const result = await service.createPlan(
      actorId,
      {
        code: "PILOT",
        name: "Pilot",
        maxWorkspaces: 3,
        maxMembers: 10,
        retentionDays: 30,
        monthlyEventLimit: 100_000,
        includedLogCount: 100_000,
        logOverageUnitPrice: 0.0001,
        features: { advancedDebug: true },
        isActive: true,
      },
      "request-1",
    );

    expect(result.code).toBe("PILOT");
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: actorId,
        action: "organization_plan.create",
        targetId: planId,
        requestId: "request-1",
        after: expect.objectContaining({ code: "PILOT" }),
        metadata: expect.objectContaining({
          request: expect.any(Object),
          response: expect.any(Object),
        }),
      }),
    );
  });

  it("비활성 요금제는 새 조직에 할당하지 않는다", async () => {
    const { service, repository } = createService();
    repository.getPlan.mockResolvedValue(planRow({ isActive: false }));

    await expect(
      service.updateOrganizationPlan(
        actorId,
        "00000000-0000-4000-8000-000000000004",
        planId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: ERROR_CODES.ADMIN_PLAN_INACTIVE,
    });
    expect(repository.updateOrganizationPlan).not.toHaveBeenCalled();
  });

  it("조직의 저장 총량과 최근 수집 분포를 숫자로 정규화한다", async () => {
    const { service, repository } = createService();
    repository.getOrganization.mockResolvedValue(organizationRow());
    repository.listOrganizationWorkspaces.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000006",
        name: "Production",
        memberCount: "2",
        agentCount: "3",
        sessionCount: "4",
        runCount: "5",
        eventCount: "20",
        totalCost: "1.25",
        latestEventAt: new Date("2026-07-29T01:00:00.000Z"),
      },
    ]);
    repository.listOrganizationMembers.mockResolvedValue([]);
    repository.getOrganizationUsage.mockResolvedValue({
      eventCount: "20",
      sessionCount: "4",
      totalCost: "1.25",
    });
    repository.getOrganizationStoredData.mockResolvedValue({
      eventCount: "20",
      sessionCount: "4",
      runCount: "5",
      agentCount: "3",
      issueCount: "2",
      openIssueCount: "1",
      firewallViolationCount: "6",
      promptCount: "2",
      firstEventAt: new Date("2026-07-28T00:00:00.000Z"),
      latestEventAt: new Date("2026-07-29T01:00:00.000Z"),
    });
    repository.getOrganizationRecentUsage.mockResolvedValue({
      eventCount24h: "10",
      eventCount7d: "20",
      eventCount30d: "20",
      sessionCount7d: "4",
      runCount7d: "5",
      totalCost7d: "1.25",
      totalCost30d: "1.25",
      promptTokens30d: "100",
      completionTokens30d: "50",
    });
    repository.listOrganizationEventTypes.mockResolvedValue([
      { eventType: "LLM_CALL", eventCount: "12" },
    ]);
    repository.listOrganizationAgentUsage.mockResolvedValue([
      {
        agentId: actorId,
        agentName: "Acme Agent",
        sessionCount: "4",
        eventCount: "20",
        totalCost: "1.25",
      },
    ]);
    repository.listOrganizationDailyEventTrend.mockResolvedValue([
      { date: "2026-07-29", eventCount: "20", totalCost: "1.25" },
    ]);
    repository.listAuditLogs.mockResolvedValue([]);

    const result = await service.getOrganization(organizationRow().id);

    expect(result.storedData.eventCount).toBe(20);
    expect(result.recentUsage.promptTokens30d).toBe(100);
    expect(result.workspaces[0]).toEqual(
      expect.objectContaining({ eventCount: 20, totalCost: 1.25 }),
    );
    expect(result.eventTypeDistribution[0]?.eventCount).toBe(12);
  });

  it("파일럿 사용 중지를 적용하고 변경 전후를 감사 기록에 남긴다", async () => {
    const { service, repository, recorder } = createService();
    repository.getPilotParticipant
      .mockResolvedValueOnce(participantRow("ACTIVE"))
      .mockResolvedValueOnce(participantRow("SUSPENDED"));
    repository.updatePilotParticipant.mockResolvedValue(true);

    const result = await service.updatePilotParticipant(
      actorId,
      participantRow().id,
      { status: "SUSPENDED" },
      "request-1",
    );

    expect(result.status).toBe("SUSPENDED");
    expect(repository.updatePilotParticipant).toHaveBeenCalledWith(
      participantRow().id,
      { status: "SUSPENDED", expiresAt: undefined },
    );
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "pilot_access.suspend",
        before: expect.objectContaining({ status: "ACTIVE" }),
        after: expect.objectContaining({ status: "SUSPENDED" }),
      }),
    );
  });

  it("사용자 목록의 수치와 관리자 권한을 운영 응답으로 변환한다", async () => {
    const { service, repository } = createService();
    repository.listUsers.mockResolvedValue([
      userRow({
        adminRole: "ADMIN",
        adminIsActive: true,
      }),
    ]);

    const result = await service.listUsers({ search: "Test", limit: 25 });

    expect(repository.listUsers).toHaveBeenCalledWith({
      search: "Test",
      limit: 25,
      cursor: undefined,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: userRow().id,
        organizationCount: 2,
        workspaceCount: 3,
        adminAccess: { role: "ADMIN", isActive: true },
      }),
    );
  });

  it("슈퍼어드민이 사용자에게 관리자 권한을 부여하고 감사 기록을 남긴다", async () => {
    const { service, repository, recorder } = createService();
    repository.getCurrentAdmin.mockResolvedValue({
      id: actorId,
      role: "SUPER_ADMIN",
      name: "Root",
      email: "root@lynx.local",
    });
    repository.getUser
      .mockResolvedValueOnce(userRow())
      .mockResolvedValueOnce(
        userRow({ adminRole: "ADMIN", adminIsActive: true }),
      );
    repository.setUserAdminRole.mockResolvedValue("UPDATED");

    const result = await service.updateUserAdminAccess(
      actorId,
      userRow().id,
      "ADMIN",
      "request-1",
    );

    expect(result.adminAccess).toEqual({ role: "ADMIN", isActive: true });
    expect(repository.setUserAdminRole).toHaveBeenCalledWith(
      userRow().id,
      "ADMIN",
      null,
    );
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_user.role_change",
        targetType: "user",
        targetId: userRow().id,
        requestId: "request-1",
      }),
    );
  });

  it("일반 관리자는 자신과 같은 관리자 등급을 부여할 수 없다", async () => {
    const { service, repository } = createService();
    repository.getCurrentAdmin.mockResolvedValue({
      id: actorId,
      role: "ADMIN",
      name: "Admin",
      email: "admin@lynx.local",
    });
    repository.getUser.mockResolvedValue(userRow());

    await expect(
      service.updateUserAdminAccess(actorId, userRow().id, "ADMIN"),
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.ADMIN_ROLE_ASSIGNMENT_FORBIDDEN,
    });
    expect(repository.setUserAdminRole).not.toHaveBeenCalled();
  });

  it("사용자 관리 화면에서 슈퍼어드민 권한을 변경하지 않는다", async () => {
    const { service, repository } = createService();
    repository.getCurrentAdmin.mockResolvedValue({
      id: actorId,
      role: "SUPER_ADMIN",
      name: "Root",
      email: "root@lynx.local",
    });
    repository.getUser.mockResolvedValue(
      userRow({ adminRole: "SUPER_ADMIN", adminIsActive: true }),
    );

    await expect(
      service.updateUserAdminAccess(actorId, userRow().id, null),
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.ADMIN_ROLE_ASSIGNMENT_FORBIDDEN,
    });
    expect(repository.setUserAdminRole).not.toHaveBeenCalled();
  });

  it("상위 관리자가 일반 사용자와 소유 조직을 삭제하고 감사 기록을 남긴다", async () => {
    const { service, repository, recorder } = createService();
    repository.getCurrentAdmin.mockResolvedValue({
      id: actorId,
      role: "SENIOR_ADMIN",
      name: "Senior",
      email: "senior@lynx.local",
    });
    repository.getUser.mockResolvedValue(userRow());
    repository.deleteNonAdminUser.mockResolvedValue({
      status: "DELETED",
      userProfileImageKey: null,
      organizationImages: [],
      deletedOrganizationIds: [organizationRow().id],
    });

    await expect(
      service.deleteUser(
        actorId,
        userRow().id,
        { confirmationEmail: userRow().email },
        "request-1",
      ),
    ).resolves.toEqual({ success: true });
    expect(repository.deleteNonAdminUser).toHaveBeenCalledWith(userRow().id);
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.delete",
        targetId: userRow().id,
      }),
    );
  });
});
