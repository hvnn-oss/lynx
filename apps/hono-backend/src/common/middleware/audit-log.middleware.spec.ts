import { Hono } from "hono";
import type { AppEnv } from "../types/app-env.js";
import type { AuditLogRecorder } from "../services/audit-log.service.js";
import {
  captureAuditRequest,
  createAuditLogMiddleware,
  describeAuditedMutation,
  sanitizeAuditValue,
} from "./audit-log.middleware.js";

describe("auditLogMiddleware", () => {
  it("성공한 관리 변경 요청을 사용자와 workspace 기준으로 기록한다", async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const app = new Hono<AppEnv>();
    app.use("*", createAuditLogMiddleware({ record } as AuditLogRecorder));
    app.post("/workspace/5f6c0d7a-b194-4b27-a85f-a9bd0415f12a/prompts", (c) => {
      c.set("currentUserId", "user-1");
      c.set("requestId", "request-1");
      return c.json({ success: true }, 201);
    });

    const response = await app.request(
      "/workspace/5f6c0d7a-b194-4b27-a85f-a9bd0415f12a/prompts",
      { method: "POST" },
    );

    expect(response.status).toBe(201);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        action: "prompt.create",
        targetType: "prompt",
        targetId: "5f6c0d7a-b194-4b27-a85f-a9bd0415f12a",
        workspaceId: "5f6c0d7a-b194-4b27-a85f-a9bd0415f12a",
        requestId: "request-1",
      }),
    );
  });

  it("실패 응답과 조회 요청은 기록하지 않는다", async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const app = new Hono<AppEnv>();
    app.use("*", createAuditLogMiddleware({ record } as AuditLogRecorder));
    app.post("/workspace/create", (c) => {
      c.set("currentUserId", "user-1");
      return c.json({ error: true }, 400);
    });
    app.get("/workspace/create", (c) => {
      c.set("currentUserId", "user-1");
      return c.json({ ok: true });
    });

    await app.request("/workspace/create", { method: "POST" });
    await app.request("/workspace/create");

    expect(record).not.toHaveBeenCalled();
  });
});

describe("describeAuditedMutation", () => {
  it("방화벽 배포 작업을 구분한다", () => {
    expect(
      describeAuditedMutation(
        "POST",
        "/workspace/5f6c0d7a-b194-4b27-a85f-a9bd0415f12a/firewall-policies/42/deploy",
      ),
    ).toEqual({
      action: "firewall_policy.deploy",
      targetType: "firewall_policy",
      targetId: "42",
      workspaceId: "5f6c0d7a-b194-4b27-a85f-a9bd0415f12a",
      organizationId: undefined,
    });
  });

  it("조직 멤버 역할 변경, Owner 위임, 조직 삭제를 구분한다", () => {
    const organizationId = "5f6c0d7a-b194-4b27-a85f-a9bd0415f12a";
    expect(
      describeAuditedMutation(
        "PATCH",
        `/organization/${organizationId}/members/7/role`,
      ),
    ).toMatchObject({
      action: "organization_member.role_change",
      targetId: "7",
      organizationId,
    });
    expect(
      describeAuditedMutation("POST", `/organization/${organizationId}/owner`),
    ).toMatchObject({
      action: "organization_owner.transfer",
      targetId: organizationId,
      organizationId,
    });
    expect(
      describeAuditedMutation("DELETE", `/organization/${organizationId}`),
    ).toMatchObject({
      action: "organization.delete",
      targetId: organizationId,
      organizationId,
    });
  });
});

describe("audit payload capture", () => {
  it("민감한 인증정보를 마스킹하고 일반 요청 데이터는 유지한다", async () => {
    const request = new Request("http://localhost/settings?tab=security", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Lynx",
        password: "plain-secret",
        access_token: "access-token",
        nested: { apiKey: "key-value", enabled: true },
      }),
    });

    await expect(captureAuditRequest(request)).resolves.toEqual({
      query: { tab: "security" },
      body: {
        name: "Lynx",
        password: "[REDACTED]",
        access_token: "[REDACTED]",
        nested: { apiKey: "[REDACTED]", enabled: true },
      },
    });
  });

  it("깊이가 과도한 payload와 긴 배열을 제한한다", () => {
    expect(
      sanitizeAuditValue({
        token: "secret",
        values: Array.from({ length: 101 }, (_, index) => index),
      }),
    ).toEqual(
      expect.objectContaining({
        token: "[REDACTED]",
        values: expect.arrayContaining(["[TRUNCATED]"]),
      }),
    );
  });
});
