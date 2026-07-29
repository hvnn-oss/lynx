import {
  WEBHOOK_DELIVERY_STATUS,
  WEBHOOK_DELIVERY_PROVIDER,
  type WebhookDeliveryProvider,
  type WebhookDeliveryStatus,
} from "@repo/constants";
import { WebhookDeliveryEntity } from "@repo/database";
import { Brackets } from "typeorm";
import { AppDataSource } from "../database/typeorm-config.js";
import { env } from "../../common/config/config.js";
import { WebhookRequestError } from "./http-webhook.service.js";

const PROCESSING_LOCK_TIMEOUT_MS = 5 * 60 * 1_000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1_000;
const RETRY_DELAYS_MS = [
  5_000,
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
];

/** Webhook Outbox의 claim, 상태 전이, 운영 조회를 담당합니다. */
export class WebhookDeliveryRepository {
  /** 여러 서버 인스턴스가 같은 작업을 집지 않도록 SKIP LOCKED로 전송 대상을 claim합니다. */
  claimReady(
    workerId: string,
    limit: number,
  ): Promise<WebhookDeliveryEntity[]> {
    return AppDataSource.transaction(async (manager) => {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - PROCESSING_LOCK_TIMEOUT_MS);
      const repository = manager.getRepository(WebhookDeliveryEntity);
      const deliveries = await repository
        .createQueryBuilder("delivery")
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .where(
          new Brackets((query) => {
            query
              .where(
                new Brackets((ready) => {
                  ready
                    .where("delivery.status IN (:...readyStatuses)", {
                      readyStatuses: [
                        WEBHOOK_DELIVERY_STATUS.PENDING,
                        WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED,
                      ],
                    })
                    .andWhere("delivery.nextAttemptAt <= :now", { now });
                }),
              )
              .orWhere(
                new Brackets((stale) => {
                  stale
                    .where("delivery.status = :processing", {
                      processing: WEBHOOK_DELIVERY_STATUS.PROCESSING,
                    })
                    .andWhere("delivery.lockedAt < :staleBefore", {
                      staleBefore,
                    });
                }),
              );
          }),
        )
        .orderBy("delivery.nextAttemptAt", "ASC")
        .addOrderBy("delivery.createdAt", "ASC")
        .take(limit)
        .getMany();

      for (const delivery of deliveries) {
        delivery.status = WEBHOOK_DELIVERY_STATUS.PROCESSING;
        delivery.attemptCount += 1;
        delivery.lastAttemptAt = now;
        delivery.lockedAt = now;
        delivery.lockedBy = workerId;
      }
      return repository.save(deliveries);
    });
  }

  /** 성공한 작업을 최종 완료 상태로 전환합니다. */
  async markDelivered(
    delivery: WebhookDeliveryEntity,
    workerId: string,
    statusCode: number,
  ): Promise<void> {
    await AppDataSource.getRepository(WebhookDeliveryEntity).update(
      {
        id: delivery.id,
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        lockedBy: workerId,
      },
      {
        status: WEBHOOK_DELIVERY_STATUS.DELIVERED,
        responseStatus: statusCode,
        lastError: null,
        deliveredAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    );
  }

  /** 오류 종류와 남은 시도 횟수에 따라 재시도 또는 최종 실패로 전환합니다. */
  async markFailed(
    delivery: WebhookDeliveryEntity,
    workerId: string,
    error: unknown,
  ): Promise<WebhookDeliveryStatus> {
    const retryable =
      !(error instanceof WebhookRequestError) || error.retryable;
    const canRetry = retryable && delivery.attemptCount < delivery.maxAttempts;
    const status = canRetry
      ? WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED
      : WEBHOOK_DELIVERY_STATUS.FAILED;
    const scheduledDelay =
      RETRY_DELAYS_MS[
        Math.min(delivery.attemptCount - 1, RETRY_DELAYS_MS.length - 1)
      ] ?? RETRY_DELAYS_MS.at(-1)!;
    const delay =
      error instanceof WebhookRequestError && error.retryAfterMs !== null
        ? Math.min(Math.max(error.retryAfterMs, 0), MAX_RETRY_AFTER_MS)
        : scheduledDelay;
    await AppDataSource.getRepository(WebhookDeliveryEntity).update(
      {
        id: delivery.id,
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        lockedBy: workerId,
      },
      {
        status,
        nextAttemptAt: canRetry
          ? new Date(Date.now() + delay)
          : delivery.nextAttemptAt,
        responseStatus:
          error instanceof WebhookRequestError ? error.statusCode : null,
        lastError: normalizeError(error),
        lockedAt: null,
        lockedBy: null,
      },
    );
    return status;
  }

  /** 정책별 전송 이력을 생성 시각 역순으로 조회합니다. */
  list(input: {
    workspaceId: string;
    policyId: string;
    provider?: WebhookDeliveryProvider;
    status?: WebhookDeliveryStatus;
    cursor?: string;
    limit: number;
  }): Promise<WebhookDeliveryEntity[]> {
    const query = AppDataSource.getRepository(WebhookDeliveryEntity)
      .createQueryBuilder("delivery")
      .where("delivery.workspaceId = :workspaceId", {
        workspaceId: input.workspaceId,
      })
      .andWhere("delivery.policyId = :policyId", {
        policyId: input.policyId,
      })
      .andWhere("delivery.provider = :provider", {
        provider: input.provider ?? WEBHOOK_DELIVERY_PROVIDER.GENERIC,
      })
      .orderBy("delivery.createdAt", "DESC")
      .addOrderBy("delivery.id", "DESC")
      .take(input.limit + 1);
    if (input.status) {
      query.andWhere("delivery.status = :status", { status: input.status });
    }
    if (input.cursor) {
      const [createdAt, id] = input.cursor.split("|");
      if (createdAt && id) {
        query.andWhere(
          new Brackets((cursor) => {
            cursor
              .where("delivery.createdAt < :createdAt", { createdAt })
              .orWhere(
                "delivery.createdAt = :createdAt AND delivery.id < :id",
                { createdAt, id },
              );
          }),
        );
      }
    }
    return query.getMany();
  }

  /** 워크스페이스 Integration의 최근 전송을 provider 기준으로 제한 조회합니다. */
  listWorkspaceProvider(
    workspaceId: string,
    provider: WebhookDeliveryProvider,
    limit: number,
  ): Promise<WebhookDeliveryEntity[]> {
    return AppDataSource.getRepository(WebhookDeliveryEntity)
      .createQueryBuilder("delivery")
      .where("delivery.workspaceId = :workspaceId", { workspaceId })
      .andWhere("delivery.provider = :provider", { provider })
      .orderBy("delivery.createdAt", "DESC")
      .addOrderBy("delivery.id", "DESC")
      .take(limit)
      .getMany();
  }

  find(
    workspaceId: string,
    policyId: string,
    deliveryId: string,
    provider: WebhookDeliveryProvider = WEBHOOK_DELIVERY_PROVIDER.GENERIC,
  ): Promise<WebhookDeliveryEntity | null> {
    return AppDataSource.getRepository(WebhookDeliveryEntity).findOneBy({
      id: deliveryId,
      workspaceId,
      policyId,
      provider,
    });
  }

  /** provider 경계를 포함해 워크스페이스 전송 하나를 조회합니다. */
  findWorkspaceProvider(
    workspaceId: string,
    provider: WebhookDeliveryProvider,
    deliveryId: string,
  ): Promise<WebhookDeliveryEntity | null> {
    return AppDataSource.getRepository(WebhookDeliveryEntity).findOneBy({
      id: deliveryId,
      workspaceId,
      provider,
    });
  }

  /** 최종 실패 또는 예약된 작업을 운영자가 즉시 다시 보낼 수 있게 초기화합니다. */
  async retry(
    workspaceId: string,
    policyId: string,
    deliveryId: string,
    provider: WebhookDeliveryProvider = WEBHOOK_DELIVERY_PROVIDER.GENERIC,
  ): Promise<WebhookDeliveryEntity | null> {
    const repository = AppDataSource.getRepository(WebhookDeliveryEntity);
    const result = await repository
      .createQueryBuilder()
      .update(WebhookDeliveryEntity)
      .set({
        status: WEBHOOK_DELIVERY_STATUS.PENDING,
        maxAttempts: () => `"attemptCount" + :additionalAttempts`,
        nextAttemptAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where("id = :deliveryId", { deliveryId })
      .andWhere('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere('"policyId" = :policyId', { policyId })
      .andWhere("provider = :provider", { provider })
      .andWhere("status IN (:...retryableStatuses)", {
        retryableStatuses: [
          WEBHOOK_DELIVERY_STATUS.FAILED,
          WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED,
        ],
      })
      .setParameter("additionalAttempts", env.FIREWALL_WEBHOOK_MAX_ATTEMPTS)
      .execute();
    if (result.affected !== 1) return null;
    return this.find(workspaceId, policyId, deliveryId, provider);
  }

  /** 정책과 무관한 Integration 전송을 경쟁 상태 없이 다시 예약합니다. */
  async retryWorkspaceProvider(
    workspaceId: string,
    provider: WebhookDeliveryProvider,
    deliveryId: string,
  ): Promise<WebhookDeliveryEntity | null> {
    const repository = AppDataSource.getRepository(WebhookDeliveryEntity);
    const result = await repository
      .createQueryBuilder()
      .update(WebhookDeliveryEntity)
      .set({
        status: WEBHOOK_DELIVERY_STATUS.PENDING,
        maxAttempts: () => `"attemptCount" + :additionalAttempts`,
        nextAttemptAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where("id = :deliveryId", { deliveryId })
      .andWhere('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere("provider = :provider", { provider })
      .andWhere("status IN (:...retryableStatuses)", {
        retryableStatuses: [
          WEBHOOK_DELIVERY_STATUS.FAILED,
          WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED,
        ],
      })
      .setParameter("additionalAttempts", env.FIREWALL_WEBHOOK_MAX_ATTEMPTS)
      .execute();
    if (result.affected !== 1) return null;
    return this.findWorkspaceProvider(workspaceId, provider, deliveryId);
  }

  /** 보존 기간이 지난 완료·최종 실패 이력을 정리합니다. */
  async purgeTerminalBefore(cutoff: Date): Promise<number> {
    const result = await AppDataSource.getRepository(WebhookDeliveryEntity)
      .createQueryBuilder()
      .delete()
      .where("status IN (:...statuses)", {
        statuses: [
          WEBHOOK_DELIVERY_STATUS.DELIVERED,
          WEBHOOK_DELIVERY_STATUS.FAILED,
        ],
      })
      .andWhere("updatedAt < :cutoff", { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}

function normalizeError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "FIREWALL_WEBHOOK_UNKNOWN_ERROR";
  return message.slice(0, 1_000);
}

export const webhookDeliveryRepository = new WebhookDeliveryRepository();
