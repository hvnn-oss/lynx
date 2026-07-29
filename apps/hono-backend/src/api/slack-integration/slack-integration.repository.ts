import { SlackIntegrationEntity, WebhookDeliveryEntity } from "@repo/database";
import { WEBHOOK_DELIVERY_PROVIDER } from "@repo/constants";
import type { SlackNotificationEventType } from "@repo/constants";
import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import { firewallNotificationService } from "../../common/services/firewall-notification.service.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { webhookDeliveryRepository } from "../../provider/webhook/webhook-delivery.repository.js";

interface SaveSlackIntegrationInput {
  workspaceId: string;
  webhookUrlCiphertext: string;
  displayName: string | null;
  isEnabled: boolean;
  eventTypes: SlackNotificationEventType[];
  updatedByUserId: string;
}

/** Slack Integration 설정과 Slack provider 전송 이력을 저장합니다. */
export class SlackIntegrationRepository {
  find(workspaceId: string): Promise<SlackIntegrationEntity | null> {
    return AppDataSource.getRepository(SlackIntegrationEntity).findOneBy({
      workspaceId,
    });
  }

  /** 최초 연결 경쟁에서도 workspace별 설정 하나만 남도록 저장합니다. */
  async save(
    input: SaveSlackIntegrationInput,
  ): Promise<SlackIntegrationEntity> {
    const repository = AppDataSource.getRepository(SlackIntegrationEntity);
    const assign = (entity: SlackIntegrationEntity) => {
      entity.webhookUrlCiphertext = input.webhookUrlCiphertext;
      entity.displayName = input.displayName;
      entity.isEnabled = input.isEnabled;
      entity.eventTypes = input.eventTypes;
      entity.updatedByUserId = input.updatedByUserId;
      return entity;
    };
    const existing = await repository.findOneBy({
      workspaceId: input.workspaceId,
    });
    if (existing) return repository.save(assign(existing));

    try {
      return await repository.save(
        assign(
          repository.create({
            workspaceId: input.workspaceId,
          }),
        ),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const concurrent = await repository.findOneByOrFail({
        workspaceId: input.workspaceId,
      });
      return repository.save(assign(concurrent));
    }
  }

  /** 연결 정보와 암호화된 목적지가 남은 Slack Outbox를 함께 제거합니다. */
  delete(workspaceId: string): Promise<void> {
    return AppDataSource.transaction(async (manager) => {
      await manager.getRepository(WebhookDeliveryEntity).delete({
        workspaceId,
        provider: WEBHOOK_DELIVERY_PROVIDER.SLACK,
      });
      await manager.getRepository(SlackIntegrationEntity).delete({
        workspaceId,
      });
    });
  }

  listDeliveries(workspaceId: string, limit = 10) {
    return webhookDeliveryRepository.listWorkspaceProvider(
      workspaceId,
      WEBHOOK_DELIVERY_PROVIDER.SLACK,
      limit,
    );
  }

  findDelivery(workspaceId: string, deliveryId: string) {
    return webhookDeliveryRepository.findWorkspaceProvider(
      workspaceId,
      WEBHOOK_DELIVERY_PROVIDER.SLACK,
      deliveryId,
    );
  }

  retryDelivery(workspaceId: string, deliveryId: string) {
    return webhookDeliveryRepository.retryWorkspaceProvider(
      workspaceId,
      WEBHOOK_DELIVERY_PROVIDER.SLACK,
      deliveryId,
    );
  }

  /** 저장된 암호화 목적지를 사용해 실제 worker가 처리하는 테스트를 예약합니다. */
  createTest(
    workspaceId: string,
    integration: SlackIntegrationEntity,
  ): Promise<WebhookDeliveryEntity> {
    return AppDataSource.transaction((manager: EntityManager) =>
      firewallNotificationService.enqueueDestination(manager, {
        workspaceId,
        policyId: null,
        policyRevision: null,
        destinationUrl: integration.webhookUrlCiphertext,
        provider: WEBHOOK_DELIVERY_PROVIDER.SLACK,
        type: "slack.test",
        deduplicationKey: `slack.test:${randomUUID()}`,
        data: {
          displayName: integration.displayName,
          message: "Lynx Slack integration test",
        },
      }),
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export const slackIntegrationRepository = new SlackIntegrationRepository();
