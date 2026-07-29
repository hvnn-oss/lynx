import type { WebhookDeliveryEntity } from "@repo/database";
import type { WebhookDeliveryRepository } from "../../provider/webhook/webhook-delivery.repository.js";
import type { WebhookService } from "../../provider/webhook/webhook.service.js";
import { WebhookRequestError } from "../../provider/webhook/http-webhook.service.js";
import type { SlackWebhookService } from "../../provider/slack/slack-webhook.service.js";
import type { IntegrationSecretCipher } from "../security/integration-secret-cipher.js";
import { WebhookDeliveryWorker } from "./webhook-delivery-worker.js";

function delivery(): WebhookDeliveryEntity {
  return {
    id: "0782d59b-d50a-4f2e-93c2-2bd7cf4ec94f",
    eventId: "a77c2374-5d68-4a79-96e5-881a0eb76978",
    eventType: "firewall.blocked",
    provider: "GENERIC",
    destinationUrl: "https://hooks.example.com/lynx",
    occurredAt: new Date("2026-07-29T00:00:00.000Z"),
    workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
    data: { action: "BLOCK" },
    attemptCount: 1,
  } as WebhookDeliveryEntity;
}

describe("WebhookDeliveryWorker", () => {
  it("claim한 Outbox 이벤트를 전송하고 성공 상태로 변경한다", async () => {
    const item = delivery();
    const repository = {
      claimReady: jest.fn().mockResolvedValue([item]),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
      purgeTerminalBefore: jest.fn().mockResolvedValue(0),
    } as unknown as WebhookDeliveryRepository;
    const webhook = {
      send: jest.fn().mockResolvedValue({ statusCode: 204 }),
    } as unknown as WebhookService;

    const processed = await new WebhookDeliveryWorker(
      repository,
      webhook,
    ).runOnce();

    expect(processed).toBe(1);
    expect(webhook.send).toHaveBeenCalledWith(item.destinationUrl, {
      id: item.eventId,
      type: "firewall.blocked",
      occurredAt: item.occurredAt.toISOString(),
      workspaceId: item.workspaceId,
      data: item.data,
    });
    expect(repository.markDelivered).toHaveBeenCalledWith(
      item,
      expect.stringMatching(/^webhook-/),
      204,
    );
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("전송 오류를 repository에 전달해 재시도 상태를 결정한다", async () => {
    const item = delivery();
    const error = new WebhookRequestError(
      "FIREWALL_WEBHOOK_FAILED_503",
      true,
      503,
    );
    const repository = {
      claimReady: jest.fn().mockResolvedValue([item]),
      markDelivered: jest.fn(),
      markFailed: jest.fn().mockResolvedValue("RETRY_SCHEDULED"),
      purgeTerminalBefore: jest.fn().mockResolvedValue(0),
    } as unknown as WebhookDeliveryRepository;
    const webhook = {
      send: jest.fn().mockRejectedValue(error),
    } as unknown as WebhookService;

    await new WebhookDeliveryWorker(repository, webhook).runOnce();

    expect(repository.markFailed).toHaveBeenCalledWith(
      item,
      expect.stringMatching(/^webhook-/),
      error,
    );
    expect(repository.markDelivered).not.toHaveBeenCalled();
  });

  it("Slack 전송은 암호화된 목적지를 복호화하고 Slack formatter를 사용한다", async () => {
    const item = {
      ...delivery(),
      provider: "SLACK",
      destinationUrl: "v1.encrypted",
    } as WebhookDeliveryEntity;
    const repository = {
      claimReady: jest.fn().mockResolvedValue([item]),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
      purgeTerminalBefore: jest.fn().mockResolvedValue(0),
    } as unknown as WebhookDeliveryRepository;
    const webhook = {
      send: jest.fn(),
    } as unknown as WebhookService;
    const slack = {
      send: jest.fn().mockResolvedValue({ statusCode: 200 }),
    } as unknown as SlackWebhookService;
    const secretCipher = {
      decrypt: jest
        .fn()
        .mockReturnValue("https://hooks.slack.com/services/T/B/secret"),
    } as unknown as IntegrationSecretCipher;

    await new WebhookDeliveryWorker(
      repository,
      webhook,
      slack,
      secretCipher,
    ).runOnce();

    expect(secretCipher.decrypt).toHaveBeenCalledWith("v1.encrypted");
    expect(slack.send).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/secret",
      expect.objectContaining({ id: item.eventId }),
    );
    expect(webhook.send).not.toHaveBeenCalled();
  });

  it("Slack 목적지 복호화에 실패하면 영구 실패로 분류할 오류를 기록한다", async () => {
    const item = {
      ...delivery(),
      provider: "SLACK",
      destinationUrl: "invalid-ciphertext",
    } as WebhookDeliveryEntity;
    const repository = {
      claimReady: jest.fn().mockResolvedValue([item]),
      markDelivered: jest.fn(),
      markFailed: jest.fn().mockResolvedValue("FAILED"),
      purgeTerminalBefore: jest.fn().mockResolvedValue(0),
    } as unknown as WebhookDeliveryRepository;
    const webhook = {
      send: jest.fn(),
    } as unknown as WebhookService;
    const slack = {
      send: jest.fn(),
    } as unknown as SlackWebhookService;
    const secretCipher = {
      decrypt: jest.fn(() => {
        throw new Error("invalid ciphertext");
      }),
    } as unknown as IntegrationSecretCipher;

    await new WebhookDeliveryWorker(
      repository,
      webhook,
      slack,
      secretCipher,
    ).runOnce();

    expect(repository.markFailed).toHaveBeenCalledWith(
      item,
      expect.stringMatching(/^webhook-/),
      expect.objectContaining({
        message: "SLACK_WEBHOOK_SECRET_DECRYPTION_FAILED",
        retryable: false,
      }),
    );
    expect(slack.send).not.toHaveBeenCalled();
    expect(webhook.send).not.toHaveBeenCalled();
  });

  it("이전 배치가 처리 중이면 중복 worker 실행을 시작하지 않는다", async () => {
    let releaseClaim!: (items: WebhookDeliveryEntity[]) => void;
    const claim = new Promise<WebhookDeliveryEntity[]>((resolve) => {
      releaseClaim = resolve;
    });
    const repository = {
      claimReady: jest.fn().mockReturnValue(claim),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
      purgeTerminalBefore: jest.fn().mockResolvedValue(0),
    } as unknown as WebhookDeliveryRepository;
    const webhook = {
      send: jest.fn(),
    } as unknown as WebhookService;
    const worker = new WebhookDeliveryWorker(repository, webhook);

    const firstRun = worker.runOnce();
    await expect(worker.runOnce()).resolves.toBe(0);
    releaseClaim([]);
    await expect(firstRun).resolves.toBe(0);
    expect(repository.claimReady).toHaveBeenCalledTimes(1);
  });

  it("배치 처리 시 보존 기간이 지난 완료 이력을 정리한다", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
    const repository = {
      claimReady: jest.fn().mockResolvedValue([]),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
      purgeTerminalBefore: jest.fn().mockResolvedValue(2),
    } as unknown as WebhookDeliveryRepository;
    const webhook = {
      send: jest.fn(),
    } as unknown as WebhookService;

    await new WebhookDeliveryWorker(repository, webhook).runOnce();

    expect(repository.purgeTerminalBefore).toHaveBeenCalledWith(
      expect.any(Date),
    );
    const cutoff = jest.mocked(repository.purgeTerminalBefore).mock.calls[0]![0];
    expect(cutoff.getTime()).toBeLessThan(Date.now());
    jest.useRealTimers();
  });
});
