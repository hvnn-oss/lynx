import { randomUUID } from "node:crypto";
import { WEBHOOK_DELIVERY_PROVIDER } from "@repo/constants";
import type { WebhookDeliveryEntity } from "@repo/database";
import { env } from "../config/config.js";
import { logger } from "../logger/logger.js";
import {
  IntegrationSecretCipher,
  integrationSecretCipher,
} from "../security/integration-secret-cipher.js";
import {
  WebhookDeliveryRepository,
  webhookDeliveryRepository,
} from "../../provider/webhook/webhook-delivery.repository.js";
import { getWebhookService } from "../../provider/webhook/webhook-provider.js";
import { WebhookRequestError } from "../../provider/webhook/http-webhook.service.js";
import type { WebhookService } from "../../provider/webhook/webhook.service.js";
import {
  SlackWebhookService,
  slackWebhookService,
} from "../../provider/slack/slack-webhook.service.js";

/** 영속 Outbox를 주기적으로 비우고 실패한 Webhook을 지수 백오프로 재시도합니다. */
export class WebhookDeliveryWorker {
  private readonly workerId = `webhook-${randomUUID()}`;
  private timer?: NodeJS.Timeout;
  private isProcessing = false;
  private lastCleanupAt = 0;

  constructor(
    private readonly repository: WebhookDeliveryRepository = webhookDeliveryRepository,
    private readonly webhook: WebhookService = getWebhookService(),
    private readonly slack: SlackWebhookService = slackWebhookService,
    private readonly secretCipher: IntegrationSecretCipher = integrationSecretCipher,
  ) {}

  /** 서버 시작과 함께 Outbox 처리를 시작합니다. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, env.FIREWALL_WEBHOOK_POLL_INTERVAL_MS);
    void this.runOnce();
  }

  /** 새 claim을 중단하고 진행 중인 한 배치가 끝날 때까지 제한된 시간 동안 기다립니다. */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const deadline = Date.now() + env.FIREWALL_WEBHOOK_TIMEOUT_MS + 1_000;
    while (this.isProcessing && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /** 테스트와 즉시 처리를 위해 한 배치만 실행하고 claim한 개수를 반환합니다. */
  async runOnce(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    try {
      const deliveries = await this.repository.claimReady(
        this.workerId,
        env.FIREWALL_WEBHOOK_BATCH_SIZE,
      );
      await Promise.all(deliveries.map((delivery) => this.deliver(delivery)));
      await this.cleanupIfDue();
      return deliveries.length;
    } catch (error) {
      logger.error(
        { event: "webhook.worker.failed", err: error },
        "webhook delivery worker failed",
      );
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  private async deliver(delivery: WebhookDeliveryEntity): Promise<void> {
    try {
      const event = {
        id: delivery.eventId,
        type: delivery.eventType as Parameters<
          WebhookService["send"]
        >[1]["type"],
        occurredAt: delivery.occurredAt.toISOString(),
        workspaceId: delivery.workspaceId,
        data: delivery.data,
      };
      const result =
        delivery.provider === WEBHOOK_DELIVERY_PROVIDER.SLACK
          ? await this.slack.send(
              this.decryptSlackDestination(delivery.destinationUrl),
              event,
            )
          : await this.webhook.send(delivery.destinationUrl, event);
      await this.repository.markDelivered(
        delivery,
        this.workerId,
        result.statusCode,
      );
      logger.info(
        {
          event: "webhook.delivery.succeeded",
          deliveryId: delivery.id,
          eventType: delivery.eventType,
          attemptCount: delivery.attemptCount,
          statusCode: result.statusCode,
        },
        "webhook delivered",
      );
    } catch (error) {
      const status = await this.repository.markFailed(
        delivery,
        this.workerId,
        error,
      );
      logger.warn(
        {
          event: "webhook.delivery.failed",
          deliveryId: delivery.id,
          eventType: delivery.eventType,
          attemptCount: delivery.attemptCount,
          deliveryStatus: status,
          err: error,
        },
        "webhook delivery failed",
      );
    }
  }

  private decryptSlackDestination(ciphertext: string): string {
    try {
      return this.secretCipher.decrypt(ciphertext);
    } catch {
      throw new WebhookRequestError(
        "SLACK_WEBHOOK_SECRET_DECRYPTION_FAILED",
        false,
      );
    }
  }

  /** 정리 쿼리는 한 시간에 한 번만 실행해 평상시 DB 부하를 줄입니다. */
  private async cleanupIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupAt < 60 * 60 * 1_000) return;
    this.lastCleanupAt = now;
    const cutoff = new Date(
      now - env.FIREWALL_WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    );
    const deleted = await this.repository.purgeTerminalBefore(cutoff);
    if (deleted > 0) {
      logger.info(
        { event: "webhook.delivery.retention_cleanup", deleted },
        "expired webhook delivery records removed",
      );
    }
  }
}

export const webhookDeliveryWorker = new WebhookDeliveryWorker();
