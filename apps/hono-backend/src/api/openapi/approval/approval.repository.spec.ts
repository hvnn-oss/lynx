import {
  FirewallApprovalRequestEntity,
  FirewallPolicyEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { firewallNotificationService } from "../../../common/services/firewall-notification.service.js";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";
import { OpenAPIApprovalRepository } from "./approval.repository.js";

jest.mock("../../../common/services/firewall-notification.service.js", () => ({
  firewallNotificationService: {
    enqueueConfigured: jest.fn(),
  },
}));

const workspaceId = "00000000-0000-4000-8000-000000000001";

function approval(
  overrides: Partial<FirewallApprovalRequestEntity> = {},
): FirewallApprovalRequestEntity {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    workspaceId,
    policyId: "7",
    reportedPolicyId: "7",
    sdkInstanceId: "sdk-1",
    clientRequestId: "request-1",
    runId: "run-1",
    sessionId: "session-1",
    agentId: "agent-1",
    toolName: "send_payment",
    inputHash: "abc123",
    requestReason: "High value payment",
    status: "PENDING",
    expiresAt: new Date("2026-07-29T00:01:00.000Z"),
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
    ...overrides,
  } as FirewallApprovalRequestEntity;
}

describe("OpenAPIApprovalRepository webhook events", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("새 승인 요청 저장과 같은 트랜잭션에 approval.requested를 예약한다", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
    const policy = { id: 7 } as FirewallPolicyEntity;
    const requestRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) =>
        approval({
          ...value,
          id: "00000000-0000-4000-8000-000000000010",
        }),
      ),
    };
    const policyRepository = {
      findOne: jest.fn().mockResolvedValue(policy),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FirewallApprovalRequestEntity) return requestRepository;
        if (entity === FirewallPolicyEntity) return policyRepository;
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    const result = await new OpenAPIApprovalRepository().create(
      workspaceId,
      "sdk-1",
      {
        clientRequestId: "request-1",
        runId: "run-1",
        sessionId: "session-1",
        agentId: "agent-1",
        policyId: "7",
        toolName: "send_payment",
        inputHash: "abc123",
        reason: "High value payment",
        timeoutMs: 60_000,
      },
    );

    expect(result.isNew).toBe(true);
    expect(firewallNotificationService.enqueueConfigured).toHaveBeenCalledWith(
      manager,
      {
        workspaceId,
        policyId: "7",
        type: "approval.requested",
        deduplicationKey:
          "approval.requested:00000000-0000-4000-8000-000000000010",
        data: {
          approvalId: "00000000-0000-4000-8000-000000000010",
          toolName: "send_payment",
          runId: "run-1",
          sessionId: "session-1",
          agentId: "agent-1",
          expiresAt: "2026-07-29T00:01:00.000Z",
        },
      },
    );
  });

  it("같은 clientRequestId의 중복 요청에는 알림을 다시 예약하지 않는다", async () => {
    const existing = approval();
    const requestRepository = {
      findOneBy: jest.fn().mockResolvedValue(existing),
    };
    const manager = {
      getRepository: jest.fn(() => requestRepository),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    const result = await new OpenAPIApprovalRepository().create(
      workspaceId,
      "sdk-1",
      {
        clientRequestId: "request-1",
        runId: "run-1",
        agentId: "agent-1",
        toolName: "send_payment",
        inputHash: "abc123",
        timeoutMs: 60_000,
      },
    );

    expect(result).toEqual({ request: existing, isNew: false });
    expect(
      firewallNotificationService.enqueueConfigured,
    ).not.toHaveBeenCalled();
  });

  it("대기 중인 승인 만료와 같은 트랜잭션에 approval.decided를 예약한다", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T00:02:00.000Z"));
    const current = approval();
    const query = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(current),
    };
    const requestRepository = {
      createQueryBuilder: jest.fn(() => query),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn(() => requestRepository),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    const result = await new OpenAPIApprovalRepository().expire(current);

    expect(result.status).toBe("EXPIRED");
    expect(firewallNotificationService.enqueueConfigured).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        workspaceId,
        policyId: "7",
        type: "approval.decided",
        deduplicationKey: `approval.decided:${current.id}`,
        data: expect.objectContaining({
          status: "EXPIRED",
          decisionReason: "Approval request expired.",
        }),
      }),
    );
  });

  it("이미 결정된 승인 요청은 만료 알림을 만들지 않는다", async () => {
    const current = approval({ status: "APPROVED" });
    const query = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(current),
    };
    const manager = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => query),
        save: jest.fn(),
      })),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    await expect(
      new OpenAPIApprovalRepository().expire(current),
    ).resolves.toBe(current);
    expect(
      firewallNotificationService.enqueueConfigured,
    ).not.toHaveBeenCalled();
  });
});
