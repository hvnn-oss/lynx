import { FirewallApprovalRequestEntity } from "@repo/database";
import type { EntityManager } from "typeorm";
import { firewallNotificationService } from "../../common/services/firewall-notification.service.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { FirewallApprovalRepository } from "./firewall-approval.repository.js";

jest.mock("../../common/services/firewall-notification.service.js", () => ({
  firewallNotificationService: {
    enqueueConfigured: jest.fn(),
  },
}));

const workspaceId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

function approval(
  overrides: Partial<FirewallApprovalRequestEntity> = {},
): FirewallApprovalRequestEntity {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    workspaceId,
    reportedPolicyId: "7",
    status: "PENDING",
    expiresAt: new Date("2026-07-29T00:05:00.000Z"),
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
    toolName: "send_payment",
    runId: "run-1",
    ...overrides,
  } as FirewallApprovalRequestEntity;
}

function transactionWith(current: FirewallApprovalRequestEntity) {
  const query = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(current),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => query),
    save: jest.fn(async (value) => value),
  };
  const manager = {
    getRepository: jest.fn(() => repository),
  } as unknown as EntityManager;
  jest
    .spyOn(AppDataSource, "transaction")
    .mockImplementation(async (callback) => callback(manager));
  return { manager, repository };
}

describe("FirewallApprovalRepository webhook events", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("운영자 승인과 같은 트랜잭션에 approval.decided를 예약한다", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T00:01:00.000Z"));
    const current = approval();
    const { manager } = transactionWith(current);

    const result = await new FirewallApprovalRepository().decide(
      workspaceId,
      current.id,
      userId,
      { decision: "APPROVED", reason: "Reviewed." },
    );

    expect(result).toEqual({
      request: expect.objectContaining({
        status: "APPROVED",
        decidedByUserId: userId,
        decisionReason: "Reviewed.",
      }),
      didDecide: true,
    });
    expect(firewallNotificationService.enqueueConfigured).toHaveBeenCalledWith(
      manager,
      {
        workspaceId,
        policyId: "7",
        type: "approval.decided",
        deduplicationKey: `approval.decided:${current.id}`,
        data: {
          approvalId: current.id,
          status: "APPROVED",
          decidedAt: "2026-07-29T00:01:00.000Z",
          decisionReason: "Reviewed.",
          toolName: "send_payment",
          runId: "run-1",
        },
      },
    );
  });

  it("결정 시점에 만료된 요청은 사용자 결정보다 EXPIRED를 우선한다", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T00:06:00.000Z"));
    const current = approval();
    transactionWith(current);

    const result = await new FirewallApprovalRepository().decide(
      workspaceId,
      current.id,
      userId,
      { decision: "APPROVED" },
    );

    expect(result?.request).toEqual(
      expect.objectContaining({
        status: "EXPIRED",
        decidedByUserId: null,
        decisionReason: "Approval request expired.",
      }),
    );
  });

  it("이미 결정된 요청에는 상태와 Webhook 이벤트를 중복 기록하지 않는다", async () => {
    const current = approval({
      status: "REJECTED",
      decidedAt: new Date("2026-07-29T00:01:00.000Z"),
    });
    const { repository } = transactionWith(current);

    const result = await new FirewallApprovalRepository().decide(
      workspaceId,
      current.id,
      userId,
      { decision: "APPROVED" },
    );

    expect(result).toEqual({ request: current, didDecide: false });
    expect(repository.save).not.toHaveBeenCalled();
    expect(
      firewallNotificationService.enqueueConfigured,
    ).not.toHaveBeenCalled();
  });
});
