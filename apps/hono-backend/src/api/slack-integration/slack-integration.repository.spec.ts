import {
  SlackIntegrationEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { firewallNotificationService } from "../../common/services/firewall-notification.service.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { SlackIntegrationRepository } from "./slack-integration.repository.js";

jest.mock("../../common/services/firewall-notification.service.js", () => ({
  firewallNotificationService: {
    enqueueDestination: jest.fn(),
  },
}));

const workspaceId = "00000000-0000-4000-8000-000000000001";

function integration(
  overrides: Partial<SlackIntegrationEntity> = {},
): SlackIntegrationEntity {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    webhookUrlCiphertext: "v1.old",
    displayName: "#old",
    isEnabled: true,
    eventTypes: ["FIREWALL_BLOCKED"],
    updatedByUserId: "00000000-0000-4000-8000-000000000003",
    ...overrides,
  } as SlackIntegrationEntity;
}

describe("SlackIntegrationRepository", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("기존 workspace 설정을 새 암호문과 구독 정보로 갱신한다", async () => {
    const current = integration();
    const entityRepository = {
      findOneBy: jest.fn().mockResolvedValue(current),
      save: jest.fn(async (value) => value),
    };
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue(entityRepository as never);

    const result = await new SlackIntegrationRepository().save({
      workspaceId,
      webhookUrlCiphertext: "v1.new",
      displayName: "#security",
      isEnabled: false,
      eventTypes: ["APPROVAL_REQUESTED"],
      updatedByUserId: "00000000-0000-4000-8000-000000000004",
    });

    expect(entityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: current.id,
        webhookUrlCiphertext: "v1.new",
        displayName: "#security",
        isEnabled: false,
        eventTypes: ["APPROVAL_REQUESTED"],
      }),
    );
    expect(result.webhookUrlCiphertext).toBe("v1.new");
  });

  it("동시 최초 연결 충돌 시 생성된 설정을 다시 읽어 갱신한다", async () => {
    const concurrent = integration();
    const entityRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest
        .fn()
        .mockRejectedValueOnce({ code: "23505" })
        .mockImplementationOnce(async (value) => value),
      findOneByOrFail: jest.fn().mockResolvedValue(concurrent),
    };
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue(entityRepository as never);

    const result = await new SlackIntegrationRepository().save({
      workspaceId,
      webhookUrlCiphertext: "v1.latest",
      displayName: "#alerts",
      isEnabled: true,
      eventTypes: ["FIREWALL_BLOCKED", "APPROVAL_DECIDED"],
      updatedByUserId: "00000000-0000-4000-8000-000000000004",
    });

    expect(entityRepository.findOneByOrFail).toHaveBeenCalledWith({
      workspaceId,
    });
    expect(entityRepository.save).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        id: concurrent.id,
        webhookUrlCiphertext: "v1.latest",
      }),
    );
  });

  it("연결 해제 시 Slack Outbox와 설정을 같은 트랜잭션에서 제거한다", async () => {
    const deliveryRepository = { delete: jest.fn() };
    const integrationRepository = { delete: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === WebhookDeliveryEntity) return deliveryRepository;
        if (entity === SlackIntegrationEntity) return integrationRepository;
        throw new Error("Unexpected repository");
      }),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    await new SlackIntegrationRepository().delete(workspaceId);

    expect(deliveryRepository.delete).toHaveBeenCalledWith({
      workspaceId,
      provider: "SLACK",
    });
    expect(integrationRepository.delete).toHaveBeenCalledWith({ workspaceId });
  });

  it("암호화된 목적지를 유지한 Slack 테스트 작업을 Outbox에 예약한다", async () => {
    const manager = {} as EntityManager;
    const current = integration();
    const queued = {
      id: "00000000-0000-4000-8000-000000000010",
    } as WebhookDeliveryEntity;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));
    jest
      .mocked(firewallNotificationService.enqueueDestination)
      .mockResolvedValue(queued);

    const result = await new SlackIntegrationRepository().createTest(
      workspaceId,
      current,
    );

    expect(firewallNotificationService.enqueueDestination).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        workspaceId,
        destinationUrl: current.webhookUrlCiphertext,
        provider: "SLACK",
        type: "slack.test",
      }),
    );
    expect(result).toBe(queued);
  });
});
