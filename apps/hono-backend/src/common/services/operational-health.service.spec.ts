import { env } from "../config/config.js";
import {
  OPERATIONAL_WARNING,
  OperationalHealthService,
} from "./operational-health.service.js";

describe("OperationalHealthService", () => {
  const originalRequired = env.WORKER_HEARTBEAT_REQUIRED;
  const originalIssueBacklog = env.ISSUE_RECORD_BACKLOG_WARN_COUNT;
  const originalIssueStale = env.ISSUE_RECORD_STALE_WARN_COUNT;
  const originalWebhookFailed = env.WEBHOOK_FAILED_WARN_COUNT;
  const originalRejectionMin = env.OPENAPI_REJECTION_WARN_MIN_EVENTS;
  const originalRejectionPercent = env.OPENAPI_REJECTION_WARN_PERCENT;
  const originalServerErrors = env.OPENAPI_SERVER_ERROR_WARN_COUNT;

  afterEach(() => {
    env.WORKER_HEARTBEAT_REQUIRED = originalRequired;
    env.ISSUE_RECORD_BACKLOG_WARN_COUNT = originalIssueBacklog;
    env.ISSUE_RECORD_STALE_WARN_COUNT = originalIssueStale;
    env.WEBHOOK_FAILED_WARN_COUNT = originalWebhookFailed;
    env.OPENAPI_REJECTION_WARN_MIN_EVENTS = originalRejectionMin;
    env.OPENAPI_REJECTION_WARN_PERCENT = originalRejectionPercent;
    env.OPENAPI_SERVER_ERROR_WARN_COUNT = originalServerErrors;
  });

  it("Worker 적체와 수집 오류를 운영 경고로 집계한다", async () => {
    env.WORKER_HEARTBEAT_REQUIRED = true;
    env.ISSUE_RECORD_BACKLOG_WARN_COUNT = 10;
    env.ISSUE_RECORD_STALE_WARN_COUNT = 1;
    env.WEBHOOK_FAILED_WARN_COUNT = 2;
    env.OPENAPI_REJECTION_WARN_MIN_EVENTS = 10;
    env.OPENAPI_REJECTION_WARN_PERCENT = 10;
    env.OPENAPI_SERVER_ERROR_WARN_COUNT = 3;
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          pendingCount: "12",
          staleCount: "1",
          oldestPendingAt: "2026-07-29T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          pendingCount: "4",
          staleCount: "1",
          failedLastHourCount: "2",
          oldestPendingAt: "2026-07-29T00:01:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          requestCount: "20",
          acceptedEventCount: "16",
          rejectedEventCount: "4",
          serverErrorCount: "3",
        },
      ]);
    const service = new OperationalHealthService(
      { query } as never,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
      } as never,
    );

    const result = await service.inspect(new Date("2026-07-29T01:00:00.000Z"));

    expect(result.status).toBe("degraded");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        OPERATIONAL_WARNING.WORKER_HEARTBEAT_MISSING,
        OPERATIONAL_WARNING.ISSUE_RECORD_BACKLOG_HIGH,
        OPERATIONAL_WARNING.ISSUE_RECORD_STALE,
        OPERATIONAL_WARNING.WEBHOOK_FAILURES_HIGH,
        OPERATIONAL_WARNING.WEBHOOK_DELIVERY_STALE,
        OPERATIONAL_WARNING.OPENAPI_EVENT_REJECTION_HIGH,
        OPERATIONAL_WARNING.OPENAPI_SERVER_ERRORS_HIGH,
      ]),
    );
    expect(result.ingestion.rejectionRatePercent).toBe(20);
  });

  it("정상 heartbeat와 낮은 오류율은 healthy로 반환한다", async () => {
    env.WORKER_HEARTBEAT_REQUIRED = true;
    const now = new Date("2026-07-29T01:00:00.000Z");
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { pendingCount: 0, staleCount: 0, oldestPendingAt: null },
      ])
      .mockResolvedValueOnce([
        {
          pendingCount: 0,
          staleCount: 0,
          failedLastHourCount: 0,
          oldestPendingAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          requestCount: 2,
          acceptedEventCount: 2,
          rejectedEventCount: 0,
          serverErrorCount: 0,
        },
      ]);
    const service = new OperationalHealthService(
      { query } as never,
      {
        get: jest.fn().mockResolvedValue(now.toISOString()),
        set: jest.fn(),
      } as never,
    );

    await expect(service.inspect(now)).resolves.toMatchObject({
      status: "healthy",
      warnings: [],
      worker: { isFresh: true },
    });
  });

  it("heartbeat를 다음 점검 주기보다 길게 TTL로 저장한다", async () => {
    const set = jest.fn().mockResolvedValue("OK");
    const service = new OperationalHealthService(
      { query: jest.fn() } as never,
      { get: jest.fn(), set } as never,
    );

    await service.recordWorkerHeartbeat(new Date("2026-07-29T01:00:00.000Z"));

    expect(set).toHaveBeenCalledWith(
      "lynx:worker:heartbeat",
      "2026-07-29T01:00:00.000Z",
      "EX",
      expect.any(Number),
    );
  });
});
