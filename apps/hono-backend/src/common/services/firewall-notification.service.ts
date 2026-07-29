import { createHash, randomUUID } from "node:crypto";
import {
  FirewallPolicyRevisionEntity,
  SlackIntegrationEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import {
  SLACK_NOTIFICATION_EVENT_TYPE,
  WEBHOOK_DELIVERY_PROVIDER,
  WEBHOOK_DELIVERY_STATUS,
  type SlackNotificationEventType,
  type WebhookDeliveryProvider,
} from "@repo/constants";
import type { EntityManager } from "typeorm";
import { env } from "../config/config.js";
import type { FirewallWebhookEvent } from "../../provider/webhook/webhook.service.js";

interface EnqueueWebhookInput {
  workspaceId: string;
  policyId?: string | null;
  type: FirewallWebhookEvent["type"];
  data: Record<string, unknown>;
  deduplicationKey: string;
}

const SLACK_EVENT_TYPE_BY_WEBHOOK_EVENT: Partial<
  Record<FirewallWebhookEvent["type"], SlackNotificationEventType>
> = {
  "firewall.blocked": SLACK_NOTIFICATION_EVENT_TYPE.FIREWALL_BLOCKED,
  "approval.requested": SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_REQUESTED,
  "approval.decided": SLACK_NOTIFICATION_EVENT_TYPE.APPROVAL_DECIDED,
};

/** 방화벽 도메인 이벤트를 현재 배포 정책의 Webhook Outbox에 기록합니다. */
export class FirewallNotificationService {
  /** 일반 Webhook과 Slack 설정을 함께 확인해 같은 트랜잭션에 전송 작업을 기록합니다. */
  async enqueueConfigured(
    manager: EntityManager,
    input: EnqueueWebhookInput,
  ): Promise<WebhookDeliveryEntity[]> {
    const deliveries: WebhookDeliveryEntity[] = [];
    const genericDelivery = await this.enqueue(manager, input);
    if (genericDelivery) deliveries.push(genericDelivery);
    const slackDelivery = await this.enqueueSlack(manager, input);
    if (slackDelivery) deliveries.push(slackDelivery);
    return deliveries;
  }

  /**
   * 호출자의 DB 트랜잭션 안에서 현재 활성 배포본을 확인하고 전송 작업을 생성합니다.
   * 동일 deduplicationKey는 하나의 Outbox 레코드만 만들기 때문에 재수집에도 안전합니다.
   */
  async enqueue(
    manager: EntityManager,
    input: EnqueueWebhookInput,
  ): Promise<WebhookDeliveryEntity | null> {
    if (!input.policyId || !/^\d+$/.test(input.policyId)) return null;
    const revision = await manager
      .getRepository(FirewallPolicyRevisionEntity)
      .createQueryBuilder("revision")
      .innerJoin("revision.policy", "policy")
      .innerJoin("policy.workspace", "workspace")
      .where("policy.id = :policyId", { policyId: input.policyId })
      .andWhere("workspace.id = :workspaceId", {
        workspaceId: input.workspaceId,
      })
      .andWhere("policy.activated = true")
      .andWhere("revision.revision = policy.deployedRevision")
      .getOne();
    if (!revision?.webhookUrl) return null;

    return this.enqueueDestination(manager, {
      ...input,
      policyId: input.policyId,
      policyRevision: revision.revision,
      destinationUrl: revision.webhookUrl,
      provider: WEBHOOK_DELIVERY_PROVIDER.GENERIC,
    });
  }

  /** 활성 Slack Integration이 구독한 이벤트를 암호화된 목적지와 함께 Outbox에 기록합니다. */
  async enqueueSlack(
    manager: EntityManager,
    input: EnqueueWebhookInput,
  ): Promise<WebhookDeliveryEntity | null> {
    const notificationType = SLACK_EVENT_TYPE_BY_WEBHOOK_EVENT[input.type];
    if (!notificationType) return null;
    const integration = await manager
      .getRepository(SlackIntegrationEntity)
      .findOneBy({
        workspaceId: input.workspaceId,
        isEnabled: true,
      });
    if (!integration?.eventTypes.includes(notificationType)) return null;

    return this.enqueueDestination(manager, {
      ...input,
      // SDK가 보고한 policyId는 로컬 FK와 다를 수 있으므로 Slack Outbox 관계에는 사용하지 않습니다.
      policyId: null,
      policyRevision: null,
      destinationUrl: integration.webhookUrlCiphertext,
      provider: WEBHOOK_DELIVERY_PROVIDER.SLACK,
      data: {
        ...input.data,
        reportedPolicyId: input.policyId ?? null,
        displayName: integration.displayName,
      },
    });
  }

  /** 권한 검사를 마친 테스트 요청처럼 목적지가 확정된 이벤트를 Outbox에 기록합니다. */
  async enqueueDestination(
    manager: EntityManager,
    input: EnqueueWebhookInput & {
      policyId: string | null;
      policyRevision: number | null;
      destinationUrl: string;
      provider?: WebhookDeliveryProvider;
    },
  ): Promise<WebhookDeliveryEntity> {
    const repository = manager.getRepository(WebhookDeliveryEntity);
    const provider = input.provider ?? WEBHOOK_DELIVERY_PROVIDER.GENERIC;
    const providerScopedKey =
      provider === WEBHOOK_DELIVERY_PROVIDER.GENERIC
        ? `${input.workspaceId}:${input.deduplicationKey}`
        : `${input.workspaceId}:${provider}:${input.deduplicationKey}`;
    const deduplicationKey = createHash("sha256")
      .update(providerScopedKey, "utf8")
      .digest("hex");
    const existing = await repository.findOneBy({
      deduplicationKey,
    });
    if (existing) return existing;

    const eventId = randomUUID();
    const occurredAt = new Date();
    const nextAttemptAt = new Date();
    const maxAttempts = env.FIREWALL_WEBHOOK_MAX_ATTEMPTS;
    // JSONB는 명시적으로 파라미터화해 TypeORM 드라이버별 객체 직렬화 차이를 피합니다.
    await repository
      .createQueryBuilder()
      .insert()
      .into(WebhookDeliveryEntity)
      .values({
        eventId,
        deduplicationKey,
        workspaceId: input.workspaceId,
        policyId: input.policyId,
        policyRevision: input.policyRevision,
        destinationUrl: input.destinationUrl,
        eventType: input.type,
        provider,
        occurredAt,
        data: () => "CAST(:webhookData AS jsonb)",
        status: WEBHOOK_DELIVERY_STATUS.PENDING,
        attemptCount: 0,
        maxAttempts,
        nextAttemptAt,
        lockedAt: null,
        lockedBy: null,
        lastAttemptAt: null,
        responseStatus: null,
        lastError: null,
        deliveredAt: null,
      })
      .setParameter("webhookData", JSON.stringify(input.data))
      .orIgnore()
      .execute();
    return repository.findOneByOrFail({
      deduplicationKey,
    });
  }
}

export const firewallNotificationService = new FirewallNotificationService();
