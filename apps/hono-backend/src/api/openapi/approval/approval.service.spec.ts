import type { FirewallApprovalRequestEntity } from "@repo/database";
import type { OpenAPIApprovalRepository } from "./approval.repository.js";
import { OpenAPIApprovalService } from "./approval.service.js";

jest.mock("../../../common/services/firewall-notification.service.js", () => ({
  firewallNotificationService: { enqueueConfigured: jest.fn() },
}));

describe("OpenAPIApprovalService", () => {
  const request = {
    id: "8c6e30bd-e743-4bc3-b430-074184c9c887",
    reportedPolicyId: "7",
    status: "PENDING",
    toolName: "external.write",
    runId: "run-1",
    sessionId: "session-1",
    agentId: "agent-1",
    expiresAt: new Date(Date.now() + 60_000),
    decidedAt: null,
    decisionReason: null,
  } as FirewallApprovalRequestEntity;

  it("SDK 요청을 생성하고 폴링 가능한 상태를 반환한다", async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ request, isNew: true }),
      find: jest.fn(),
      expire: jest.fn(),
    } as unknown as OpenAPIApprovalRepository;
    const service = new OpenAPIApprovalService(repository);

    await expect(
      service.create("workspace-1", "sdk-1", {
        clientRequestId: "request-1",
        runId: "run-1",
        sessionId: "session-1",
        agentId: "agent-1",
        policyId: "7",
        toolName: "external.write",
        inputHash: "abcd",
        timeoutMs: 60_000,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: request.id,
        status: "PENDING",
      }),
    );
  });

  it("대기 기한이 지난 요청을 조회할 때 만료시킨다", async () => {
    const expired = {
      ...request,
      expiresAt: new Date(Date.now() - 1),
    } as FirewallApprovalRequestEntity;
    const repository = {
      create: jest.fn(),
      find: jest.fn().mockResolvedValue(expired),
      expire: jest.fn().mockResolvedValue({
        ...expired,
        status: "EXPIRED",
        decidedAt: new Date(),
      }),
    } as unknown as OpenAPIApprovalRepository;

    const result = await new OpenAPIApprovalService(repository).get(
      "workspace-1",
      "sdk-1",
      request.id,
    );

    expect(result.status).toBe("EXPIRED");
    expect(repository.expire).toHaveBeenCalledWith(expired);
  });
});
