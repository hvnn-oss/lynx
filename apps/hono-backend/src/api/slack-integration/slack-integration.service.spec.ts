import {
  DEFAULT_SLACK_NOTIFICATION_EVENT_TYPES,
  SLACK_NOTIFICATION_EVENT_TYPE,
} from "@repo/constants";
import type {
  SlackIntegrationEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import type { IntegrationSecretCipher } from "../../common/security/integration-secret-cipher.js";
import { SlackIntegrationRepository } from "./slack-integration.repository.js";
import { SlackIntegrationService } from "./slack-integration.service.js";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

function integration(
  overrides: Partial<SlackIntegrationEntity> = {},
): SlackIntegrationEntity {
  return {
    id: "00000000-0000-4000-8000-000000000003",
    workspaceId,
    webhookUrlCiphertext: "v1.encrypted",
    displayName: "#lynx-alerts",
    isEnabled: true,
    eventTypes: [SLACK_NOTIFICATION_EVENT_TYPE.FIREWALL_BLOCKED],
    updatedByUserId: userId,
    createdAt: new Date("2026-07-28T00:00:00.000Z"),
    updatedAt: new Date("2026-07-28T00:00:00.000Z"),
    ...overrides,
  } as SlackIntegrationEntity;
}

function delivery(
  overrides: Partial<WebhookDeliveryEntity> = {},
): WebhookDeliveryEntity {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    eventType: "slack.test",
    status: "PENDING",
    attemptCount: 0,
    maxAttempts: 8,
    responseStatus: null,
    lastError: null,
    createdAt: new Date("2026-07-28T00:00:00.000Z"),
    deliveredAt: null,
    ...overrides,
  } as WebhookDeliveryEntity;
}

function dependencies(integration: SlackIntegrationEntity | null = null) {
  const repository = {
    find: jest.fn().mockResolvedValue(integration),
    save: jest.fn(),
    delete: jest.fn(),
    listDeliveries: jest.fn().mockResolvedValue([]),
    findDelivery: jest.fn(),
    retryDelivery: jest.fn(),
    createTest: jest.fn(),
  } as unknown as jest.Mocked<SlackIntegrationRepository>;
  const accessControl = {
    assertWorkspaceCapability: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessControlService;
  const secretCipher = {
    encrypt: jest.fn().mockReturnValue("v1.encrypted"),
    decrypt: jest
      .fn()
      .mockReturnValue("https://hooks.slack.com/services/T/B/secret"),
  } as unknown as IntegrationSecretCipher;
  return {
    repository,
    secretCipher,
    service: new SlackIntegrationService(
      repository,
      accessControl,
      secretCipher,
    ),
  };
}

describe("SlackIntegrationService", () => {
  it("연결 전에도 기본 알림 종류와 빈 이력을 반환한다", async () => {
    const { service } = dependencies();

    await expect(service.get(userId, workspaceId)).resolves.toEqual({
      isConfigured: false,
      isEnabled: false,
      displayName: null,
      destination: null,
      eventTypes: [...DEFAULT_SLACK_NOTIFICATION_EVENT_TYPES],
      updatedAt: null,
      deliveries: [],
    });
  });

  it("최초 연결에는 Slack Webhook URL을 요구한다", async () => {
    const { service } = dependencies();

    await expect(
      service.update(userId, workspaceId, {
        isEnabled: true,
        eventTypes: [SLACK_NOTIFICATION_EVENT_TYPE.FIREWALL_BLOCKED],
      }),
    ).rejects.toThrow("SLACK_WEBHOOK_URL_REQUIRED");
  });

  it("Webhook URL을 암호화하고 응답에는 마스킹된 목적지만 노출한다", async () => {
    const { service, repository, secretCipher } = dependencies();
    jest.mocked(repository.save).mockImplementation(
      async (input) =>
        ({
          id: "integration-1",
          createdAt: new Date("2026-07-28T00:00:00.000Z"),
          updatedAt: new Date("2026-07-28T00:00:00.000Z"),
          ...input,
        }) as SlackIntegrationEntity,
    );

    const result = await service.update(userId, workspaceId, {
      webhookUrl: "https://hooks.slack.com/services/T/B/secret",
      displayName: "#lynx-alerts",
      isEnabled: true,
      eventTypes: [SLACK_NOTIFICATION_EVENT_TYPE.FIREWALL_BLOCKED],
    });

    expect(secretCipher.encrypt).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/secret",
    );
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrlCiphertext: "v1.encrypted" }),
    );
    expect(result.destination).toBe(
      "https://hooks.slack.com/services/••••••••",
    );
    expect(JSON.stringify(result)).not.toContain("/T/B/secret");
  });

  it("기존 설정 수정 시 새 URL이 없으면 저장된 암호문을 유지한다", async () => {
    const current = integration();
    const { service, repository, secretCipher } = dependencies(current);
    jest
      .mocked(repository.save)
      .mockImplementation(async (input) => integration(input));

    const result = await service.update(userId, workspaceId, {
      displayName: "#security",
      isEnabled: false,
      eventTypes: [
        SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_REQUESTED,
        SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_REQUESTED,
      ],
    });

    expect(secretCipher.encrypt).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookUrlCiphertext: current.webhookUrlCiphertext,
        displayName: "#security",
        isEnabled: false,
        eventTypes: [SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_REQUESTED],
      }),
    );
    expect(result.isEnabled).toBe(false);
  });

  it("연결 테스트를 Outbox에 예약하고 전송 상태를 반환한다", async () => {
    const current = integration();
    const { service, repository } = dependencies(current);
    jest
      .mocked(repository.createTest)
      .mockResolvedValue(delivery({ eventType: "slack.test" }));

    const result = await service.test(userId, workspaceId);

    expect(repository.createTest).toHaveBeenCalledWith(workspaceId, current);
    expect(result.delivery).toEqual(
      expect.objectContaining({
        eventType: "slack.test",
        status: "PENDING",
      }),
    );
  });

  it("설정이 없으면 Slack 연결 테스트를 만들지 않는다", async () => {
    const { service, repository } = dependencies();

    await expect(service.test(userId, workspaceId)).rejects.toThrow(
      "SLACK_INTEGRATION_NOT_FOUND",
    );
    expect(repository.createTest).not.toHaveBeenCalled();
  });

  it("실패하거나 예약된 Slack 전송만 수동 재시도한다", async () => {
    const failed = delivery({ status: "FAILED", attemptCount: 8 });
    const retried = delivery({
      status: "PENDING",
      attemptCount: 8,
      maxAttempts: 16,
    });
    const { service, repository } = dependencies(integration());
    jest.mocked(repository.findDelivery).mockResolvedValue(failed);
    jest.mocked(repository.retryDelivery).mockResolvedValue(retried);

    await expect(
      service.retry(userId, workspaceId, failed.id),
    ).resolves.toEqual({
      delivery: expect.objectContaining({
        id: failed.id,
        status: "PENDING",
        maxAttempts: 16,
      }),
    });
    expect(repository.retryDelivery).toHaveBeenCalledWith(
      workspaceId,
      failed.id,
    );

    jest
      .mocked(repository.findDelivery)
      .mockResolvedValue(delivery({ status: "DELIVERED" }));
    await expect(
      service.retry(userId, workspaceId, failed.id),
    ).rejects.toThrow("SLACK_DELIVERY_NOT_RETRYABLE");
  });

  it("Slack 연결 해제 시 설정과 전송 이력을 repository에서 제거한다", async () => {
    const { service, repository } = dependencies(integration());

    await expect(service.delete(userId, workspaceId)).resolves.toEqual({
      success: true,
    });
    expect(repository.delete).toHaveBeenCalledWith(workspaceId);
  });
});
