import { firewallPolicyContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createFirewallPolicyHandlers } from "./firewall-policy.handler.js";
import { firewallPolicyService } from "./firewall-policy.service.js";

jest.mock("./firewall-policy.service.js", () => ({
  firewallPolicyService: {
    create: jest.fn(),
    deploy: jest.fn(),
    simulate: jest.fn(),
    webhookDeliveries: jest.fn(),
    testWebhook: jest.fn(),
    retryWebhookDelivery: jest.fn(),
  },
}));

const mockedService = jest.mocked(firewallPolicyService);
const workspaceId = "00000000-0000-4000-8000-000000000001";

function responsePolicy() {
  return {
    id: "7",
    name: "Block destructive tools",
    description: null,
    condition: "tool.riskLevel == 'CRITICAL'",
    severity: "CRITICAL" as const,
    action: "BLOCK" as const,
    version: "v1",
    environments: [],
    agentIds: [],
    activated: true,
    draftRevision: 1,
    deployedRevision: 1,
    isDirty: false,
    lastMatchedAt: null,
    recentBlockCount: 0,
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
}

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createFirewallPolicyHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    firewallPolicyContract.create.method,
    firewallPolicyContract.create.path,
    ...handlers.create,
  );
  app.on(
    firewallPolicyContract.deploy.method,
    firewallPolicyContract.deploy.path,
    ...handlers.deploy,
  );
  app.on(
    firewallPolicyContract.simulate.method,
    firewallPolicyContract.simulate.path,
    ...handlers.simulate,
  );
  app.on(
    firewallPolicyContract.webhookDeliveries.method,
    firewallPolicyContract.webhookDeliveries.path,
    ...handlers.webhookDeliveries,
  );
  app.on(
    firewallPolicyContract.testWebhook.method,
    firewallPolicyContract.testWebhook.path,
    ...handlers.testWebhook,
  );
  app.on(
    firewallPolicyContract.retryWebhookDelivery.method,
    firewallPolicyContract.retryWebhookDelivery.path,
    ...handlers.retryWebhookDelivery,
  );
  return app;
}

describe("firewall policy HTTP handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("정책 생성 요청을 검증하고 워크스페이스 컨텍스트를 전달한다", async () => {
    mockedService.create.mockResolvedValue({ policy: responsePolicy() });
    const body = {
      name: "Block destructive tools",
      condition: "tool.riskLevel == 'CRITICAL'",
      severity: "CRITICAL",
      action: "BLOCK",
      version: "v1",
    };

    const response = await createApp().request(
      `/${workspaceId}/firewall-policies`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    expect(response.status).toBe(201);
    expect(mockedService.create).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      body,
    );
  });

  it("배포할 정책 ID를 숫자로 변환한다", async () => {
    mockedService.deploy.mockResolvedValue({ policy: responsePolicy() });

    const response = await createApp().request(
      `/${workspaceId}/firewall-policies/7/deploy`,
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(mockedService.deploy).toHaveBeenCalledWith("user-1", workspaceId, 7);
  });

  it("시뮬레이션 입력을 검증해 서비스에 전달한다", async () => {
    mockedService.simulate.mockResolvedValue({
      matched: true,
      conditions: [
        {
          expression: "tool.riskLevel == 'CRITICAL'",
          field: "tool.riskLevel",
          operator: "==",
          expected: "CRITICAL",
          actual: "CRITICAL",
          matched: true,
          negated: false,
        },
      ],
      action: "BLOCK",
      severity: "CRITICAL",
      policyId: "7",
      version: "v1",
      revision: 1,
    });
    const body = {
      tool: { name: "delete_user", riskLevel: "CRITICAL" },
      input: { userId: "target" },
    };

    const response = await createApp().request(
      `/${workspaceId}/firewall-policies/7/simulate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.simulate).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      7,
      body,
    );
  });

  it("Webhook 테스트 전송을 Outbox 응답으로 반환한다", async () => {
    mockedService.testWebhook.mockResolvedValue({
      delivery: {
        id: "5e32c70e-11d9-48b7-a2a9-8843209aacdf",
        eventId: "814375cb-4fa0-4c53-a137-82b135392138",
        eventType: "webhook.test",
        status: "PENDING",
        destination: "https://hooks.example.com/lynx",
        policyRevision: 1,
        attemptCount: 0,
        maxAttempts: 8,
        nextAttemptAt: "2026-07-29T00:00:00.000Z",
        lastAttemptAt: null,
        responseStatus: null,
        lastError: null,
        deliveredAt: null,
        createdAt: "2026-07-29T00:00:00.000Z",
      },
    });

    const response = await createApp().request(
      `/${workspaceId}/firewall-policies/7/webhook-test`,
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(mockedService.testWebhook).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      7,
    );
  });

  it("Webhook 전송 이력의 상태와 커서 query를 검증해 전달한다", async () => {
    const cursor =
      "2026-07-29T00:00:00.000Z|5e32c70e-11d9-48b7-a2a9-8843209aacdf";
    mockedService.webhookDeliveries.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await createApp().request(
      `/${workspaceId}/firewall-policies/7/webhook-deliveries?status=FAILED&limit=10&cursor=${encodeURIComponent(cursor)}`,
    );

    expect(response.status).toBe(200);
    expect(mockedService.webhookDeliveries).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      7,
      { status: "FAILED", limit: 10, cursor },
    );
  });

  it("잘못된 Webhook 이력 커서는 서비스 호출 전에 거절한다", async () => {
    const response = await createApp().request(
      `/${workspaceId}/firewall-policies/7/webhook-deliveries?cursor=invalid`,
    );

    expect(response.status).toBe(400);
    expect(mockedService.webhookDeliveries).not.toHaveBeenCalled();
  });

  it("Webhook 수동 재시도 요청에 정책과 delivery ID를 전달한다", async () => {
    const deliveryId = "5e32c70e-11d9-48b7-a2a9-8843209aacdf";
    mockedService.retryWebhookDelivery.mockResolvedValue({
      delivery: {
        id: deliveryId,
        eventId: "814375cb-4fa0-4c53-a137-82b135392138",
        eventType: "firewall.blocked",
        status: "PENDING",
        destination: "https://hooks.example.com/lynx",
        policyRevision: 1,
        attemptCount: 8,
        maxAttempts: 16,
        nextAttemptAt: "2026-07-29T00:00:00.000Z",
        lastAttemptAt: "2026-07-28T23:59:00.000Z",
        responseStatus: 503,
        lastError: "FIREWALL_WEBHOOK_FAILED_503",
        deliveredAt: null,
        createdAt: "2026-07-28T00:00:00.000Z",
      },
    });

    const response = await createApp().request(
      `/${workspaceId}/firewall-policies/7/webhook-deliveries/${deliveryId}/retry`,
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(mockedService.retryWebhookDelivery).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      7,
      deliveryId,
    );
  });
});
