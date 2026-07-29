import {
  WEBHOOK_DELIVERY_PROVIDER,
  WEBHOOK_DELIVERY_STATUS,
} from "@repo/constants";
import { WebhookDeliveryEntity } from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../database/typeorm-config.js";
import {
  WebhookDeliveryRepository,
} from "./webhook-delivery.repository.js";
import { WebhookRequestError } from "./http-webhook.service.js";

function createDelivery(
  overrides: Partial<WebhookDeliveryEntity> = {},
): WebhookDeliveryEntity {
  return {
    id: "0782d59b-d50a-4f2e-93c2-2bd7cf4ec94f",
    eventId: "a77c2374-5d68-4a79-96e5-881a0eb76978",
    deduplicationKey: "deduplication-key",
    workspaceId: "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8",
    policyId: "7",
    policyRevision: 3,
    destinationUrl: "https://hooks.example.com/lynx",
    eventType: "firewall.blocked",
    provider: WEBHOOK_DELIVERY_PROVIDER.GENERIC,
    occurredAt: new Date("2026-07-29T00:00:00.000Z"),
    data: { action: "BLOCK" },
    status: WEBHOOK_DELIVERY_STATUS.PENDING,
    attemptCount: 0,
    maxAttempts: 8,
    nextAttemptAt: new Date("2026-07-29T00:00:00.000Z"),
    lockedAt: null,
    lockedBy: null,
    lastAttemptAt: null,
    responseStatus: null,
    lastError: null,
    deliveredAt: null,
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
    ...overrides,
  } as WebhookDeliveryEntity;
}

describe("WebhookDeliveryRepository", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("준비된 작업을 SKIP LOCKED로 claim하고 시도 횟수와 잠금을 기록한다", async () => {
    const item = createDelivery();
    const query = {
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([item]),
    };
    const entityRepository = {
      createQueryBuilder: jest.fn(() => query),
      save: jest.fn(async (items) => items),
    };
    const manager = {
      getRepository: jest.fn(() => entityRepository),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    const result = await new WebhookDeliveryRepository().claimReady(
      "worker-1",
      10,
    );

    expect(query.setLock).toHaveBeenCalledWith("pessimistic_write");
    expect(query.setOnLocked).toHaveBeenCalledWith("skip_locked");
    expect(query.take).toHaveBeenCalledWith(10);
    expect(result[0]).toEqual(
      expect.objectContaining({
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        attemptCount: 1,
        lockedBy: "worker-1",
      }),
    );
    expect(result[0]?.lockedAt).toBeInstanceOf(Date);
    expect(result[0]?.lastAttemptAt).toBeInstanceOf(Date);
  });

  it("429 Retry-After를 사용해 다음 전송 시각을 예약한다", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-29T01:00:00.000Z"));
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue({ update } as never);
    const item = createDelivery({
      status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
      attemptCount: 1,
      lockedBy: "worker-1",
    });

    const status = await new WebhookDeliveryRepository().markFailed(
      item,
      "worker-1",
      new WebhookRequestError(
        "FIREWALL_WEBHOOK_FAILED_429",
        true,
        429,
        20_000,
      ),
    );

    expect(status).toBe(WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED);
    expect(update).toHaveBeenCalledWith(
      {
        id: item.id,
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        lockedBy: "worker-1",
      },
      expect.objectContaining({
        status: WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED,
        nextAttemptAt: new Date("2026-07-29T01:00:20.000Z"),
        responseStatus: 429,
        lastError: "FIREWALL_WEBHOOK_FAILED_429",
        lockedAt: null,
        lockedBy: null,
      }),
    );
  });

  it.each([
    {
      name: "재시도할 수 없는 오류",
      delivery: createDelivery({
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        attemptCount: 1,
        lockedBy: "worker-1",
      }),
      error: new WebhookRequestError(
        "FIREWALL_WEBHOOK_FAILED_400",
        false,
        400,
      ),
    },
    {
      name: "최대 시도 횟수에 도달한 오류",
      delivery: createDelivery({
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        attemptCount: 8,
        maxAttempts: 8,
        lockedBy: "worker-1",
      }),
      error: new Error("NETWORK_DOWN"),
    },
  ])("$name는 최종 실패로 전환한다", async ({ delivery, error }) => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue({ update } as never);

    const status = await new WebhookDeliveryRepository().markFailed(
      delivery,
      "worker-1",
      error,
    );

    expect(status).toBe(WEBHOOK_DELIVERY_STATUS.FAILED);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: delivery.id }),
      expect.objectContaining({
        status: WEBHOOK_DELIVERY_STATUS.FAILED,
        lockedAt: null,
        lockedBy: null,
      }),
    );
  });

  it("실패한 전송만 즉시 재시도 상태로 되돌리고 추가 시도 횟수를 부여한다", async () => {
    const item = createDelivery({ status: WEBHOOK_DELIVERY_STATUS.PENDING });
    const query = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const entityRepository = {
      createQueryBuilder: jest.fn(() => query),
      findOneBy: jest.fn().mockResolvedValue(item),
    };
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue(entityRepository as never);

    const result = await new WebhookDeliveryRepository().retry(
      item.workspaceId,
      item.policyId!,
      item.id,
    );

    expect(query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: WEBHOOK_DELIVERY_STATUS.PENDING,
        lockedAt: null,
        lockedBy: null,
      }),
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      "status IN (:...retryableStatuses)",
      {
        retryableStatuses: [
          WEBHOOK_DELIVERY_STATUS.FAILED,
          WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED,
        ],
      },
    );
    expect(query.setParameter).toHaveBeenCalledWith(
      "additionalAttempts",
      expect.any(Number),
    );
    expect(result).toBe(item);
  });

  it("성공 상태 변경은 claim한 worker ID를 조건으로 수행한다", async () => {
    const update = jest.fn().mockResolvedValue({ affected: 0 });
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue({ update } as never);
    const item = createDelivery({
      status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
      lockedBy: "worker-2",
    });

    await new WebhookDeliveryRepository().markDelivered(item, "worker-1", 204);

    expect(update).toHaveBeenCalledWith(
      {
        id: item.id,
        status: WEBHOOK_DELIVERY_STATUS.PROCESSING,
        lockedBy: "worker-1",
      },
      expect.objectContaining({
        status: WEBHOOK_DELIVERY_STATUS.DELIVERED,
        responseStatus: 204,
      }),
    );
  });
});
