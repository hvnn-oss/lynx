import {
  FirewallPolicyRevisionEntity,
  SlackIntegrationEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import { createHash } from "node:crypto";
import type { EntityManager } from "typeorm";
import { FirewallNotificationService } from "./firewall-notification.service.js";

describe("FirewallNotificationService", () => {
  it("활성 배포 리비전의 URL로 중복 방지 Outbox 레코드를 만든다", async () => {
    const revisionQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        revision: 3,
        webhookUrl: "https://hooks.example.com/lynx",
      }),
    };
    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const deliveryRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => insertBuilder),
      findOneByOrFail: jest.fn().mockImplementation(async (where) => ({
        id: "delivery-1",
        destinationUrl: "https://hooks.example.com/lynx",
        policyId: "7",
        policyRevision: 3,
        status: "PENDING",
        ...where,
      })),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FirewallPolicyRevisionEntity) {
          return { createQueryBuilder: () => revisionQuery };
        }
        if (entity === WebhookDeliveryEntity) return deliveryRepository;
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;

    const result = await new FirewallNotificationService().enqueue(manager, {
      workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
      policyId: "7",
      type: "firewall.blocked",
      deduplicationKey: "firewall.blocked:sdk:event-1",
      data: { action: "BLOCK" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        destinationUrl: "https://hooks.example.com/lynx",
        policyId: "7",
        policyRevision: 3,
        status: "PENDING",
      }),
    );
    expect(insertBuilder.orIgnore).toHaveBeenCalledTimes(1);
    expect(insertBuilder.setParameter).toHaveBeenCalledWith(
      "webhookData",
      JSON.stringify({ action: "BLOCK" }),
    );
    expect(deliveryRepository.findOneByOrFail).toHaveBeenCalledWith({
      deduplicationKey: createHash("sha256")
        .update(
          "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8:firewall.blocked:sdk:event-1",
          "utf8",
        )
        .digest("hex"),
    });
  });

  it("활성 배포본에 URL이 없으면 Outbox를 만들지 않는다", async () => {
    const revisionQuery = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ revision: 3, webhookUrl: null }),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === FirewallPolicyRevisionEntity) {
          return { createQueryBuilder: () => revisionQuery };
        }
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;

    await expect(
      new FirewallNotificationService().enqueue(manager, {
        workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
        policyId: "7",
        type: "firewall.blocked",
        deduplicationKey: "firewall.blocked:sdk:event-1",
        data: {},
      }),
    ).resolves.toBeNull();
  });

  it("활성 Slack Integration이 구독한 이벤트를 별도 provider로 기록한다", async () => {
    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const deliveryRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => insertBuilder),
      findOneByOrFail: jest.fn().mockImplementation(async (where) => ({
        id: "delivery-1",
        provider: "SLACK",
        ...where,
      })),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === SlackIntegrationEntity) {
          return {
            findOneBy: jest.fn().mockResolvedValue({
              webhookUrlCiphertext: "v1.encrypted",
              displayName: "#lynx-alerts",
              isEnabled: true,
              eventTypes: ["FIREWALL_BLOCKED"],
            }),
          };
        }
        if (entity === WebhookDeliveryEntity) return deliveryRepository;
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;

    await new FirewallNotificationService().enqueueSlack(manager, {
      workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
      policyId: "7",
      type: "firewall.blocked",
      deduplicationKey: "firewall.blocked:sdk:event-1",
      data: { action: "BLOCK" },
    });

    expect(insertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "SLACK",
        destinationUrl: "v1.encrypted",
      }),
    );
    expect(insertBuilder.setParameter).toHaveBeenCalledWith(
      "webhookData",
      JSON.stringify({
        action: "BLOCK",
        reportedPolicyId: "7",
        displayName: "#lynx-alerts",
      }),
    );
  });

  it("숫자 정책 ID가 아니면 일반 Webhook 설정을 조회하지 않는다", async () => {
    const manager = {
      getRepository: jest.fn(),
    } as unknown as EntityManager;

    const result = await new FirewallNotificationService().enqueue(manager, {
      workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
      policyId: "local-policy",
      type: "firewall.blocked",
      deduplicationKey: "firewall.blocked:sdk:event-1",
      data: {},
    });

    expect(result).toBeNull();
    expect(manager.getRepository).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "비활성화된 Slack 설정",
      integration: null,
    },
    {
      name: "구독하지 않은 이벤트",
      integration: {
        isEnabled: true,
        eventTypes: ["APPROVAL_REQUESTED"],
      },
    },
  ])("$name에는 Slack Outbox를 만들지 않는다", async ({ integration }) => {
    const deliveryRepository = {
      createQueryBuilder: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === SlackIntegrationEntity) {
          return {
            findOneBy: jest.fn().mockResolvedValue(
              integration
                ? {
                    webhookUrlCiphertext: "v1.encrypted",
                    displayName: "#alerts",
                    ...integration,
                  }
                : null,
            ),
          };
        }
        if (entity === WebhookDeliveryEntity) return deliveryRepository;
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;

    const result = await new FirewallNotificationService().enqueueSlack(
      manager,
      {
        workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
        policyId: "7",
        type: "firewall.blocked",
        deduplicationKey: "firewall.blocked:sdk:event-1",
        data: {},
      },
    );

    expect(result).toBeNull();
    expect(deliveryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("같은 provider와 중복 키가 이미 있으면 기존 Outbox를 반환한다", async () => {
    const existing = {
      id: "delivery-existing",
      deduplicationKey: createHash("sha256")
        .update(
          "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8:event-key",
          "utf8",
        )
        .digest("hex"),
    } as WebhookDeliveryEntity;
    const deliveryRepository = {
      findOneBy: jest.fn().mockResolvedValue(existing),
      createQueryBuilder: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn(() => deliveryRepository),
    } as unknown as EntityManager;

    const result = await new FirewallNotificationService().enqueueDestination(
      manager,
      {
        workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
        policyId: "7",
        policyRevision: 3,
        destinationUrl: "https://hooks.example.com/lynx",
        type: "firewall.blocked",
        deduplicationKey: "event-key",
        data: {},
      },
    );

    expect(result).toBe(existing);
    expect(deliveryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("일반 Webhook과 Slack 작업을 같은 트랜잭션 manager로 함께 예약한다", async () => {
    const service = new FirewallNotificationService();
    const manager = {} as EntityManager;
    const generic = { id: "generic" } as WebhookDeliveryEntity;
    const slack = { id: "slack" } as WebhookDeliveryEntity;
    const enqueue = jest.spyOn(service, "enqueue").mockResolvedValue(generic);
    const enqueueSlack = jest
      .spyOn(service, "enqueueSlack")
      .mockResolvedValue(slack);
    const input = {
      workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
      policyId: "7",
      type: "approval.requested" as const,
      deduplicationKey: "approval.requested:request-1",
      data: { approvalId: "request-1" },
    };

    await expect(service.enqueueConfigured(manager, input)).resolves.toEqual([
      generic,
      slack,
    ]);
    expect(enqueue).toHaveBeenCalledWith(manager, input);
    expect(enqueueSlack).toHaveBeenCalledWith(manager, input);
  });
});
