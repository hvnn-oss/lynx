import { ERROR_CODES } from "@repo/constants";
import type { AuditLogRecorder } from "../../common/services/audit-log.service.js";
import {
  AdminRepository,
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

function createService() {
  const repository = {
    getCurrentAdmin: jest.fn(),
    getOverviewCounts: jest.fn(),
    getPlanDistribution: jest.fn(),
    listAuditLogs: jest.fn(),
    getAuditLog: jest.fn(),
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
    repository.listAuditLogs.mockResolvedValue([auditRow()]);

    const result = await service.getOverview(actorId);

    expect(result.metrics.organizationCount).toBe(4);
    expect(result.planDistribution[0]?.organizationCount).toBe(2);
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
});
