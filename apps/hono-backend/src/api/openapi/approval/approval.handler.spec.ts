import { openAPIContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../../common/types/app-env.js";
import { createOpenAPIApprovalHandlers } from "./approval.handler.js";
import { openAPIApprovalService } from "./approval.service.js";

jest.mock("./approval.service.js", () => ({
  openAPIApprovalService: { create: jest.fn(), get: jest.fn() },
}));

const mockedService = jest.mocked(openAPIApprovalService);

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createOpenAPIApprovalHandlers();
  app.use("*", async (c, next) => {
    c.set("currentWorkspaceId", "workspace-1");
    await next();
  });
  app.on(
    openAPIContract.createFirewallApproval.method,
    openAPIContract.createFirewallApproval.path,
    ...handlers.create,
  );
  return app;
}

describe("OpenAPI approval HTTP handlers", () => {
  it("SDK 클라이언트 ID와 승인 요청을 서비스에 전달한다", async () => {
    mockedService.create.mockResolvedValue({
      id: "8c6e30bd-e743-4bc3-b430-074184c9c887",
      status: "PENDING",
      expiresAt: "2026-07-25T12:00:00.000Z",
      decidedAt: null,
      decisionReason: null,
    });
    const body = {
      clientRequestId: "request-1",
      runId: "run-1",
      sessionId: "session-1",
      agentId: "agent-1",
      policyId: "7",
      toolName: "external.write",
      inputHash: "abcd",
      timeoutMs: 60_000,
    };

    const response = await createApp().request("/firewall-approvals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Lynx-Client-ID": "sdk-1",
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(201);
    expect(mockedService.create).toHaveBeenCalledWith(
      "workspace-1",
      "sdk-1",
      body,
    );
  });
});
