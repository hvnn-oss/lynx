import {
  DEFAULT_SLACK_NOTIFICATION_EVENT_TYPES,
  WEBHOOK_DELIVERY_STATUS,
} from "@repo/constants";
import type {
  SlackIntegrationEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import type { UpdateSlackIntegrationDto } from "@repo/dto";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import { ConflictErrorException } from "../../common/exceptions/conflict.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import {
  IntegrationSecretCipher,
  integrationSecretCipher,
} from "../../common/security/integration-secret-cipher.js";
import {
  SlackIntegrationRepository,
  slackIntegrationRepository,
} from "./slack-integration.repository.js";

/** Slack 연결 설정, 테스트, 실패 전송 재시도 유스케이스를 처리합니다. */
export class SlackIntegrationService {
  constructor(
    private readonly repository: SlackIntegrationRepository = slackIntegrationRepository,
    private readonly accessControl: AccessControlService = accessControlService,
    private readonly secretCipher: IntegrationSecretCipher = integrationSecretCipher,
  ) {}

  async get(userId: string, workspaceId: string) {
    await this.assertRead(userId, workspaceId);
    const [integration, deliveries] = await Promise.all([
      this.repository.find(workspaceId),
      this.repository.listDeliveries(workspaceId),
    ]);
    return this.toResponse(integration, deliveries);
  }

  async update(
    userId: string,
    workspaceId: string,
    input: UpdateSlackIntegrationDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    const current = await this.repository.find(workspaceId);
    if (!current && !input.webhookUrl) {
      throw new BadRequestErrorException("SLACK_WEBHOOK_URL_REQUIRED");
    }
    const webhookUrlCiphertext = input.webhookUrl
      ? this.secretCipher.encrypt(input.webhookUrl)
      : current!.webhookUrlCiphertext;
    const integration = await this.repository.save({
      workspaceId,
      webhookUrlCiphertext,
      displayName: input.displayName ?? null,
      isEnabled: input.isEnabled,
      eventTypes: [...new Set(input.eventTypes)],
      updatedByUserId: userId,
    });
    return this.toResponse(
      integration,
      await this.repository.listDeliveries(workspaceId),
    );
  }

  async delete(userId: string, workspaceId: string) {
    await this.assertWrite(userId, workspaceId);
    await this.repository.delete(workspaceId);
    return { success: true };
  }

  async test(userId: string, workspaceId: string) {
    await this.assertWrite(userId, workspaceId);
    const integration = await this.repository.find(workspaceId);
    if (!integration) {
      throw new NotFoundErrorException("SLACK_INTEGRATION_NOT_FOUND");
    }
    const delivery = await this.repository.createTest(workspaceId, integration);
    return { delivery: this.toDelivery(delivery) };
  }

  async retry(userId: string, workspaceId: string, deliveryId: string) {
    await this.assertWrite(userId, workspaceId);
    const current = await this.repository.findDelivery(workspaceId, deliveryId);
    if (!current) {
      throw new NotFoundErrorException("SLACK_DELIVERY_NOT_FOUND");
    }
    if (
      current.status !== WEBHOOK_DELIVERY_STATUS.FAILED &&
      current.status !== WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED
    ) {
      throw new BadRequestErrorException("SLACK_DELIVERY_NOT_RETRYABLE");
    }
    const delivery = await this.repository.retryDelivery(
      workspaceId,
      deliveryId,
    );
    if (!delivery) {
      throw new ConflictErrorException("SLACK_DELIVERY_RETRY_CONFLICT");
    }
    return { delivery: this.toDelivery(delivery) };
  }

  private toResponse(
    integration: SlackIntegrationEntity | null,
    deliveries: WebhookDeliveryEntity[],
  ) {
    return {
      isConfigured: Boolean(integration),
      isEnabled: integration?.isEnabled ?? false,
      displayName: integration?.displayName ?? null,
      destination: integration
        ? this.maskDestination(integration.webhookUrlCiphertext)
        : null,
      eventTypes: integration?.eventTypes ?? [
        ...DEFAULT_SLACK_NOTIFICATION_EVENT_TYPES,
      ],
      updatedAt: integration?.updatedAt.toISOString() ?? null,
      deliveries: deliveries.map((delivery) => this.toDelivery(delivery)),
    };
  }

  private toDelivery(delivery: WebhookDeliveryEntity) {
    return {
      id: delivery.id,
      eventType: delivery.eventType,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      responseStatus: delivery.responseStatus,
      lastError: delivery.lastError,
      createdAt: delivery.createdAt.toISOString(),
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    };
  }

  private maskDestination(ciphertext: string): string {
    const destination = new URL(this.secretCipher.decrypt(ciphertext));
    return `${destination.protocol}//${destination.hostname}/services/••••••••`;
  }

  private assertRead(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
  }

  private assertWrite(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_UPDATE,
    });
  }
}

export const slackIntegrationService = new SlackIntegrationService();
