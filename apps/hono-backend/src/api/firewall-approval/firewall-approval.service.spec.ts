import type { FirewallApprovalRequestEntity } from "@repo/database";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import type { FirewallApprovalRepository } from "./firewall-approval.repository.js";
import { FirewallApprovalService } from "./firewall-approval.service.js";

jest.mock("../../common/services/firewall-notification.service.js", () => ({
  firewallNotificationService: { notify: jest.fn() },
}));

describe("FirewallApprovalService", () => {
  it("운영자의 승인 결정을 SDK가 조회할 상태로 저장한다", async () => {
    const decided = {
      id: "8c6e30bd-e743-4bc3-b430-074184c9c887",
      reportedPolicyId: "7",
      toolName: "external.write",
      runId: "run-1",
      status: "APPROVED",
      expiresAt: new Date(Date.now() + 60_000),
      decidedAt: new Date(),
      decisionReason: "Reviewed.",
    } as FirewallApprovalRequestEntity;
    const repository = {
      decide: jest.fn().mockResolvedValue({
        request: decided,
        didDecide: true,
      }),
    } as unknown as FirewallApprovalRepository;
    const accessControl = {
      assertWorkspaceCapability: jest.fn(),
    } as unknown as AccessControlService;

    const result = await new FirewallApprovalService(
      repository,
      accessControl,
    ).decide("user-1", "00000000-0000-4000-8000-000000000001", decided.id, {
      decision: "APPROVED",
      reason: "Reviewed.",
    });

    expect(result.status).toBe("APPROVED");
    expect(repository.decide).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      decided.id,
      "user-1",
      { decision: "APPROVED", reason: "Reviewed." },
    );
  });
});
