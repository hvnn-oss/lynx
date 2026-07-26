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
    activated: true,
    draftRevision: 1,
    deployedRevision: 1,
    isDirty: false,
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
  return app;
}

describe("firewall policy HTTP handlers", () => {
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
});
