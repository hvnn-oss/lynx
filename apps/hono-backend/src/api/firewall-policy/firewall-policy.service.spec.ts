import type {
  FirewallPolicyEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import type { FirewallPolicyRepository } from "./firewall-policy.repository.js";
import { FirewallPolicyService } from "./firewall-policy.service.js";

describe("FirewallPolicyService", () => {
  const workspaceId = "14ec8c0d-bdff-4375-ac32-fac5577238d7";
  const userId = "7cdd6248-926c-4414-b71c-a8c819643021";

  function policy(overrides: Partial<FirewallPolicyEntity> = {}) {
    return {
      id: 7,
      name: "Block destructive tools",
      description: null,
      condition: "tool.riskLevel == 'CRITICAL'",
      severity: "CRITICAL",
      action: "BLOCK",
      version: "v1",
      activated: false,
      draftRevision: 1,
      deployedRevision: null,
      deletedAt: null,
      createdAt: new Date("2026-07-25T00:00:00.000Z"),
      updatedAt: new Date("2026-07-25T00:00:00.000Z"),
      ...overrides,
    } as FirewallPolicyEntity;
  }

  function webhookDelivery(
    overrides: Partial<WebhookDeliveryEntity> = {},
  ): WebhookDeliveryEntity {
    const createdAt = new Date("2026-07-29T00:00:00.000Z");
    return {
      id: "5e32c70e-11d9-48b7-a2a9-8843209aacdf",
      eventId: "814375cb-4fa0-4c53-a137-82b135392138",
      eventType: "webhook.test",
      status: "PENDING",
      destinationUrl: "https://hooks.example.com/lynx",
      policyRevision: 1,
      attemptCount: 0,
      maxAttempts: 8,
      nextAttemptAt: createdAt,
      lastAttemptAt: null,
      responseStatus: null,
      lastError: null,
      deliveredAt: null,
      createdAt,
      ...overrides,
    } as WebhookDeliveryEntity;
  }

  function dependencies(current = policy()) {
    const repository = {
      list: jest.fn().mockResolvedValue([current]),
      find: jest.fn().mockResolvedValue(current),
      create: jest.fn().mockResolvedValue(current),
      updateDraft: jest
        .fn()
        .mockImplementation(async (_workspaceId, _id, body) => ({
          status: "updated",
          policy: {
            ...current,
            ...body,
            draftRevision: current.draftRevision + 1,
          },
        })),
      getViolationStats: jest.fn().mockResolvedValue(new Map()),
      listRevisions: jest.fn().mockResolvedValue([]),
      listRecords: jest.fn().mockResolvedValue([]),
      deploy: jest.fn().mockResolvedValue({
        ...current,
        activated: true,
        deployedRevision: current.draftRevision,
      }),
      findRevision: jest.fn().mockResolvedValue({
        policyId: String(current.id),
        revision: 1,
      }),
      rollback: jest.fn().mockResolvedValue({
        ...current,
        activated: true,
        deployedRevision: 1,
      }),
      setActivated: jest.fn().mockImplementation(async (entity, activated) => ({
        ...entity,
        activated,
      })),
      softDelete: jest.fn(),
      listWebhookDeliveries: jest.fn().mockResolvedValue([]),
      createWebhookTest: jest.fn(),
      findWebhookDelivery: jest.fn(),
      retryWebhookDelivery: jest.fn(),
    } as unknown as FirewallPolicyRepository;
    const accessControl = {
      assertWorkspaceCapability: jest.fn(),
    } as unknown as AccessControlService;
    return {
      repository,
      accessControl,
      service: new FirewallPolicyService(repository, accessControl),
    };
  }

  it("수정한 초안은 별도 리비전으로 표시하고 즉시 배포하지 않는다", async () => {
    const { service, repository } = dependencies();

    const result = await service.update(userId, workspaceId, 7, {
      condition: "input.amount > 1000",
      version: "v2",
      expectedDraftRevision: 1,
    });

    expect(result.policy).toEqual(
      expect.objectContaining({
        condition: "input.amount > 1000",
        draftRevision: 2,
        deployedRevision: null,
        isDirty: true,
      }),
    );
    expect(repository.updateDraft).toHaveBeenCalled();
    expect(repository.deploy).not.toHaveBeenCalled();
  });

  it("배포되지 않은 정책은 activate로 우회할 수 없다", async () => {
    const { service } = dependencies();

    await expect(
      service.activate(userId, workspaceId, 7),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
  });

  it("시뮬레이션은 SDK 조건 문법으로 현재 초안을 평가한다", async () => {
    const { service } = dependencies();

    await expect(
      service.simulate(userId, workspaceId, 7, {
        tool: { name: "delete_user", riskLevel: "CRITICAL" },
        input: {},
      }),
    ).resolves.toEqual({
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
  });

  it("지원하지 않는 조건은 저장 전에 거절한다", async () => {
    const { service } = dependencies();

    await expect(
      service.create(userId, workspaceId, {
        name: "Unsafe expression",
        condition: "globalThis.process.exit()",
        severity: "HIGH",
        action: "BLOCK",
        version: "v1",
      }),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
  });

  it("Webhook 이력에서 목적지 query 값을 제거하고 전송 상태를 반환한다", async () => {
    const { service, repository } = dependencies();
    const createdAt = new Date("2026-07-29T00:00:00.000Z");
    jest.mocked(repository.listWebhookDeliveries).mockResolvedValue([
      {
        id: "5e32c70e-11d9-48b7-a2a9-8843209aacdf",
        eventId: "814375cb-4fa0-4c53-a137-82b135392138",
        eventType: "firewall.blocked",
        status: "DELIVERED",
        destinationUrl:
          "https://hooks.example.com/lynx?token=must-not-be-returned",
        policyRevision: 1,
        attemptCount: 1,
        maxAttempts: 8,
        nextAttemptAt: createdAt,
        lastAttemptAt: createdAt,
        responseStatus: 204,
        lastError: null,
        deliveredAt: createdAt,
        createdAt,
      } as WebhookDeliveryEntity,
    ]);

    const result = await service.webhookDeliveries(userId, workspaceId, 7, {
      limit: 25,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        destination: "https://hooks.example.com/lynx",
        status: "DELIVERED",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("must-not-be-returned");
  });

  it("Webhook URL이 없는 정책은 테스트 전송을 만들지 않는다", async () => {
    const { service, repository } = dependencies(policy({ webhookUrl: null }));

    await expect(
      service.testWebhook(userId, workspaceId, 7),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
    expect(repository.createWebhookTest).not.toHaveBeenCalled();
  });

  it("저장된 정책 URL로 테스트 전송을 예약한다", async () => {
    const current = policy({
      webhookUrl: "https://hooks.example.com/lynx",
    });
    const { service, repository } = dependencies(current);
    const queued = webhookDelivery();
    jest.mocked(repository.createWebhookTest).mockResolvedValue(queued);

    const result = await service.testWebhook(userId, workspaceId, 7);

    expect(repository.createWebhookTest).toHaveBeenCalledWith(
      workspaceId,
      current,
      current.webhookUrl,
    );
    expect(result.delivery).toEqual(
      expect.objectContaining({
        id: queued.id,
        status: "PENDING",
        destination: "https://hooks.example.com/lynx",
      }),
    );
  });

  it("Webhook 이력은 limit보다 한 건 더 조회한 결과로 다음 커서를 만든다", async () => {
    const { service, repository } = dependencies();
    const first = webhookDelivery({
      id: "5e32c70e-11d9-48b7-a2a9-8843209aacdf",
      createdAt: new Date("2026-07-29T02:00:00.000Z"),
    });
    const second = webhookDelivery({
      id: "b5a83ec3-68d7-4b75-bc89-fddb7ef07fd2",
      createdAt: new Date("2026-07-29T01:00:00.000Z"),
    });
    jest
      .mocked(repository.listWebhookDeliveries)
      .mockResolvedValue([first, second]);

    const result = await service.webhookDeliveries(
      userId,
      workspaceId,
      7,
      { limit: 1 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe(
      "2026-07-29T02:00:00.000Z|5e32c70e-11d9-48b7-a2a9-8843209aacdf",
    );
  });

  it("실패한 Webhook 전송을 수동 재시도하고 갱신된 상태를 반환한다", async () => {
    const { service, repository } = dependencies();
    const failed = webhookDelivery({
      status: "FAILED",
      attemptCount: 8,
      lastError: "FIREWALL_WEBHOOK_FAILED_503",
    });
    const retried = webhookDelivery({
      status: "PENDING",
      attemptCount: 8,
      maxAttempts: 16,
    });
    jest.mocked(repository.findWebhookDelivery).mockResolvedValue(failed);
    jest.mocked(repository.retryWebhookDelivery).mockResolvedValue(retried);

    const result = await service.retryWebhookDelivery(
      userId,
      workspaceId,
      7,
      failed.id,
    );

    expect(repository.retryWebhookDelivery).toHaveBeenCalledWith(
      workspaceId,
      7,
      failed.id,
    );
    expect(result.delivery).toEqual(
      expect.objectContaining({
        status: "PENDING",
        maxAttempts: 16,
      }),
    );
  });

  it("성공했거나 처리 중인 Webhook은 수동 재시도를 거절한다", async () => {
    const { service, repository } = dependencies();
    const delivered = webhookDelivery({ status: "DELIVERED" });
    jest.mocked(repository.findWebhookDelivery).mockResolvedValue(delivered);

    await expect(
      service.retryWebhookDelivery(
        userId,
        workspaceId,
        7,
        delivered.id,
      ),
    ).rejects.toThrow("WEBHOOK_DELIVERY_NOT_RETRYABLE");
    expect(repository.retryWebhookDelivery).not.toHaveBeenCalled();
  });
});
