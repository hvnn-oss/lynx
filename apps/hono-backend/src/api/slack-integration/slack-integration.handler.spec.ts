import { integrationContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createSlackIntegrationHandlers } from "./slack-integration.handler.js";
import { slackIntegrationService } from "./slack-integration.service.js";

jest.mock("./slack-integration.service.js", () => ({
  slackIntegrationService: {
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    test: jest.fn(),
    retry: jest.fn(),
  },
}));

const mockedService = jest.mocked(slackIntegrationService);
const workspaceId = "00000000-0000-4000-8000-000000000001";

function response() {
  return {
    isConfigured: true,
    isEnabled: true,
    displayName: "#lynx-alerts",
    destination: "https://hooks.slack.com/services/••••••••",
    eventTypes: ["FIREWALL_BLOCKED"] as const,
    updatedAt: "2026-07-28T00:00:00.000Z",
    deliveries: [],
  };
}

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createSlackIntegrationHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    integrationContract.getSlack.method,
    integrationContract.getSlack.path,
    ...handlers.get,
  );
  app.on(
    integrationContract.updateSlack.method,
    integrationContract.updateSlack.path,
    ...handlers.update,
  );
  app.on(
    integrationContract.testSlack.method,
    integrationContract.testSlack.path,
    ...handlers.test,
  );
  app.on(
    integrationContract.deleteSlack.method,
    integrationContract.deleteSlack.path,
    ...handlers.remove,
  );
  app.on(
    integrationContract.retrySlackDelivery.method,
    integrationContract.retrySlackDelivery.path,
    ...handlers.retry,
  );
  return app;
}

describe("Slack integration HTTP handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Slack 설정을 검증해 workspace와 함께 서비스에 전달한다", async () => {
    mockedService.update.mockResolvedValue(response());
    const body = {
      webhookUrl: "https://hooks.slack.com/services/T000/B000/secret",
      displayName: "#lynx-alerts",
      isEnabled: true,
      eventTypes: ["FIREWALL_BLOCKED"],
    };

    const result = await createApp().request(
      `/${workspaceId}/integrations/slack`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    expect(result.status).toBe(200);
    expect(mockedService.update).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      body,
    );
  });

  it("테스트 전송 요청을 서비스에 전달한다", async () => {
    mockedService.test.mockResolvedValue({
      delivery: {
        id: "00000000-0000-4000-8000-000000000010",
        eventType: "slack.test",
        status: "PENDING",
        attemptCount: 0,
        maxAttempts: 8,
        responseStatus: null,
        lastError: null,
        createdAt: "2026-07-28T00:00:00.000Z",
        deliveredAt: null,
      },
    });

    const result = await createApp().request(
      `/${workspaceId}/integrations/slack/test`,
      { method: "POST" },
    );

    expect(result.status).toBe(200);
    expect(mockedService.test).toHaveBeenCalledWith("user-1", workspaceId);
  });

  it("저장된 Slack 설정과 최근 전송 이력을 조회한다", async () => {
    mockedService.get.mockResolvedValue(response());

    const result = await createApp().request(
      `/${workspaceId}/integrations/slack`,
    );

    expect(result.status).toBe(200);
    expect(mockedService.get).toHaveBeenCalledWith("user-1", workspaceId);
    await expect(result.json()).resolves.toEqual(response());
  });

  it("허용하지 않는 Slack URL은 서비스 호출 전에 거절한다", async () => {
    const result = await createApp().request(
      `/${workspaceId}/integrations/slack`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: "https://example.com/services/T/B/secret",
          isEnabled: true,
          eventTypes: ["FIREWALL_BLOCKED"],
        }),
      },
    );

    expect(result.status).toBe(400);
    expect(mockedService.update).not.toHaveBeenCalled();
  });

  it("Slack 연결 해제 요청을 서비스에 전달한다", async () => {
    mockedService.delete.mockResolvedValue({ success: true });

    const result = await createApp().request(
      `/${workspaceId}/integrations/slack`,
      { method: "DELETE" },
    );

    expect(result.status).toBe(200);
    expect(mockedService.delete).toHaveBeenCalledWith("user-1", workspaceId);
  });

  it("실패한 Slack 전송 재시도 요청에 delivery ID를 전달한다", async () => {
    const deliveryId = "00000000-0000-4000-8000-000000000010";
    mockedService.retry.mockResolvedValue({
      delivery: {
        id: deliveryId,
        eventType: "firewall.blocked",
        status: "PENDING",
        attemptCount: 3,
        maxAttempts: 11,
        responseStatus: 503,
        lastError: "SLACK_WEBHOOK_FAILED_503",
        createdAt: "2026-07-28T00:00:00.000Z",
        deliveredAt: null,
      },
    });

    const result = await createApp().request(
      `/${workspaceId}/integrations/slack/deliveries/${deliveryId}/retry`,
      { method: "POST" },
    );

    expect(result.status).toBe(200);
    expect(mockedService.retry).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      deliveryId,
    );
  });
});
