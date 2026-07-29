import { adminContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createAdminHandlers } from "./admin.handler.js";
import { adminService } from "./admin.service.js";

jest.mock("./admin.service.js", () => ({
  adminService: {
    getOverview: jest.fn(),
    listAuditLogs: jest.fn(),
    getAuditLog: jest.fn(),
    listApiKeys: jest.fn(),
    getOpenApiUsage: jest.fn(),
    revokeApiKey: jest.fn(),
    listOrganizations: jest.fn(),
    getOrganization: jest.fn(),
    updateOrganizationPlan: jest.fn(),
    listPilotParticipants: jest.fn(),
    updatePilotParticipant: jest.fn(),
    listPlans: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
  },
}));

const mockedService = jest.mocked(adminService);
const organizationId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-000000000002";

function createApp() {
  const handlers = createAdminHandlers();
  const app = new Hono<AppEnv>();
  app.use("*", async (context, next) => {
    context.set("currentUserId", "admin-user-1");
    context.set("requestId", "request-1");
    await next();
  });
  app.on(
    adminContract.listAuditLogs.method,
    adminContract.listAuditLogs.path,
    ...handlers.listAuditLogs,
  );
  app.on(
    adminContract.listApiKeys.method,
    adminContract.listApiKeys.path,
    ...handlers.listApiKeys,
  );
  app.on(
    adminContract.getOpenApiUsage.method,
    adminContract.getOpenApiUsage.path,
    ...handlers.getOpenApiUsage,
  );
  app.on(
    adminContract.revokeApiKey.method,
    adminContract.revokeApiKey.path,
    ...handlers.revokeApiKey,
  );
  app.on(
    adminContract.createPlan.method,
    adminContract.createPlan.path,
    ...handlers.createPlan,
  );
  app.on(
    adminContract.updateOrganizationPlan.method,
    adminContract.updateOrganizationPlan.path,
    ...handlers.updateOrganizationPlan,
  );
  app.on(
    adminContract.listPilotParticipants.method,
    adminContract.listPilotParticipants.path,
    ...handlers.listPilotParticipants,
  );
  app.on(
    adminContract.updatePilotParticipant.method,
    adminContract.updatePilotParticipant.path,
    ...handlers.updatePilotParticipant,
  );
  return app;
}

function responsePlan() {
  return {
    id: planId,
    code: "PILOT",
    name: "Pilot",
    maxWorkspaces: 3,
    maxMembers: 10,
    retentionDays: 30,
    monthlyEventLimit: 100_000,
    includedLogCount: 100_000,
    logOverageUnitPrice: 0.0001,
    features: {},
    isActive: true,
    organizationCount: 0,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  };
}

function responseOrganization() {
  const plan = responsePlan();
  return {
    id: organizationId,
    name: "Acme",
    owner: {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Owner",
      email: "owner@acme.test",
    },
    plan: {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      maxWorkspaces: plan.maxWorkspaces,
      maxMembers: plan.maxMembers,
      retentionDays: plan.retentionDays,
      monthlyEventLimit: plan.monthlyEventLimit,
      includedLogCount: plan.includedLogCount,
      logOverageUnitPrice: plan.logOverageUnitPrice,
      features: plan.features,
      isActive: plan.isActive,
    },
    workspaceCount: 0,
    memberCount: 1,
    storedEventCount: 0,
    latestEventAt: null,
    createdAt: "2026-07-29T00:00:00.000Z",
    workspaces: [],
    members: [],
    currentMonthUsage: {
      eventCount: 0,
      sessionCount: 0,
      totalCost: 0,
    },
    storedData: {
      eventCount: 0,
      sessionCount: 0,
      runCount: 0,
      agentCount: 0,
      issueCount: 0,
      openIssueCount: 0,
      firewallViolationCount: 0,
      promptCount: 0,
      firstEventAt: null,
      latestEventAt: null,
    },
    recentUsage: {
      eventCount24h: 0,
      eventCount7d: 0,
      eventCount30d: 0,
      sessionCount7d: 0,
      runCount7d: 0,
      totalCost7d: 0,
      totalCost30d: 0,
      promptTokens30d: 0,
      completionTokens30d: 0,
    },
    eventTypeDistribution: [],
    agentUsage: [],
    dailyEventTrend: [],
    recentAuditLogs: [],
  };
}

function responseApiKey() {
  return {
    id: "00000000-0000-4000-8000-000000000007",
    name: "Production SDK",
    prefix: "lynx_production",
    kind: "SDK" as const,
    scopes: ["events:write" as const],
    status: "ACTIVE" as const,
    workspace: {
      id: "00000000-0000-4000-8000-000000000008",
      name: "Production",
    },
    organization: {
      id: organizationId,
      name: "Acme",
    },
    createdBy: {
      id: null,
      name: "Owner",
    },
    createdAt: "2026-07-29T00:00:00.000Z",
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
  };
}

describe("admin HTTP handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("API Key 목록 필터를 검증해 서비스에 전달한다", async () => {
    mockedService.listApiKeys.mockResolvedValue({
      items: [responseApiKey()],
      nextCursor: null,
    });

    const response = await createApp().request(
      "/api-keys?status=ACTIVE&kind=SDK",
    );

    expect(response.status).toBe(200);
    expect(mockedService.listApiKeys).toHaveBeenCalledWith({
      status: "ACTIVE",
      kind: "SDK",
      limit: 25,
    });
  });

  it("API Key 폐기 요청에 관리자와 요청 ID를 전달한다", async () => {
    const apiKey = responseApiKey();
    mockedService.revokeApiKey.mockResolvedValue({
      ...apiKey,
      status: "REVOKED",
      revokedAt: "2026-07-29T01:00:00.000Z",
    });

    const response = await createApp().request(
      `/api-keys/${apiKey.id}/revoke`,
      { method: "PATCH" },
    );

    expect(response.status).toBe(200);
    expect(mockedService.revokeApiKey).toHaveBeenCalledWith(
      "admin-user-1",
      apiKey.id,
      "request-1",
    );
  });

  it("감사 기록 query의 기본 limit을 검증해 서비스에 전달한다", async () => {
    mockedService.listAuditLogs.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await createApp().request("/audit-logs?search=prompt");

    expect(response.status).toBe(200);
    expect(mockedService.listAuditLogs).toHaveBeenCalledWith({
      search: "prompt",
      limit: 25,
    });
  });

  it("새 요금제를 생성하고 201로 반환한다", async () => {
    mockedService.createPlan.mockResolvedValue(responsePlan());
    const body = {
      code: "pilot",
      name: "Pilot",
      maxWorkspaces: 3,
      maxMembers: 10,
      retentionDays: 30,
      monthlyEventLimit: 100_000,
      includedLogCount: 100_000,
      logOverageUnitPrice: 0.0001,
      features: {},
      isActive: true,
    };

    const response = await createApp().request("/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(201);
    expect(mockedService.createPlan).toHaveBeenCalledWith(
      "admin-user-1",
      expect.objectContaining({ code: "PILOT" }),
      "request-1",
    );
  });

  it("조직과 요금제 ID를 검증해 할당 서비스에 전달한다", async () => {
    mockedService.updateOrganizationPlan.mockResolvedValue(
      responseOrganization(),
    );

    const response = await createApp().request(
      `/organizations/${organizationId}/plan`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.updateOrganizationPlan).toHaveBeenCalledWith(
      "admin-user-1",
      organizationId,
      planId,
      "request-1",
    );
  });

  it("파일럿 사용자 조회 조건의 기본값을 검증한다", async () => {
    mockedService.listPilotParticipants.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await createApp().request(
      "/pilot/participants?status=ACTIVE",
    );

    expect(response.status).toBe(200);
    expect(mockedService.listPilotParticipants).toHaveBeenCalledWith({
      status: "ACTIVE",
      limit: 25,
    });
  });

  it("파일럿 사용 중지 요청을 서비스에 전달한다", async () => {
    mockedService.updatePilotParticipant.mockResolvedValue({
      id: planId,
      user: {
        id: organizationId,
        name: "Pilot User",
        email: "pilot@lynx.local",
      },
      status: "SUSPENDED",
      grantedByUserId: null,
      grantedAt: "2026-07-29T00:00:00.000Z",
      expiresAt: null,
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
    });

    const response = await createApp().request(
      `/pilot/participants/${planId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "SUSPENDED" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.updatePilotParticipant).toHaveBeenCalledWith(
      "admin-user-1",
      planId,
      { status: "SUSPENDED" },
      "request-1",
    );
  });
});
