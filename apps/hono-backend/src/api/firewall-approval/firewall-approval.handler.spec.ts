import { firewallApprovalContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createFirewallApprovalHandlers } from "./firewall-approval.handler.js";
import { firewallApprovalService } from "./firewall-approval.service.js";

jest.mock("./firewall-approval.service.js", () => ({
  firewallApprovalService: { list: jest.fn(), decide: jest.fn() },
}));

const mockedService = jest.mocked(firewallApprovalService);
const workspaceId = "00000000-0000-4000-8000-000000000001";
const approvalId = "8c6e30bd-e743-4bc3-b430-074184c9c887";

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createFirewallApprovalHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    firewallApprovalContract.decide.method,
    firewallApprovalContract.decide.path,
    ...handlers.decide,
  );
  return app;
}

describe("firewall approval HTTP handlers", () => {
  it("운영자의 승인 결정을 검증해 서비스에 전달한다", async () => {
    mockedService.decide.mockResolvedValue({
      id: approvalId,
      status: "APPROVED",
      expiresAt: "2026-07-25T12:00:00.000Z",
      decidedAt: "2026-07-25T11:00:00.000Z",
      decisionReason: "Reviewed.",
    });

    const response = await createApp().request(
      `/${workspaceId}/firewall-approvals/${approvalId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVED",
          reason: "Reviewed.",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.decide).toHaveBeenCalledWith(
      "user-1",
      workspaceId,
      approvalId,
      { decision: "APPROVED", reason: "Reviewed." },
    );
  });
});
