import type { DataSource } from "typeorm";
import type { Redis } from "ioredis";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { coreRedis } from "../../provider/redis/redis-config.js";
import { env } from "../config/config.js";

const WORKER_HEARTBEAT_KEY = "lynx:worker:heartbeat";
const STALE_JOB_WINDOW_MS = 5 * 60_000;
const RECENT_OPERATION_WINDOW_MS = 60 * 60_000;

export const OPERATIONAL_WARNING = {
  WORKER_HEARTBEAT_MISSING: "WORKER_HEARTBEAT_MISSING",
  ISSUE_RECORD_BACKLOG_HIGH: "ISSUE_RECORD_BACKLOG_HIGH",
  ISSUE_RECORD_STALE: "ISSUE_RECORD_STALE",
  WEBHOOK_FAILURES_HIGH: "WEBHOOK_FAILURES_HIGH",
  WEBHOOK_DELIVERY_STALE: "WEBHOOK_DELIVERY_STALE",
  OPENAPI_EVENT_REJECTION_HIGH: "OPENAPI_EVENT_REJECTION_HIGH",
  OPENAPI_SERVER_ERRORS_HIGH: "OPENAPI_SERVER_ERRORS_HIGH",
} as const;

interface CountRow {
  pendingCount: string | number;
  staleCount: string | number;
  oldestPendingAt: Date | string | null;
}

interface UsageRow {
  requestCount: string | number;
  rejectedEventCount: string | number;
  acceptedEventCount: string | number;
  serverErrorCount: string | number;
}

export interface OperationalHealthSnapshot {
  status: "healthy" | "degraded";
  warnings: string[];
  checkedAt: string;
  worker: {
    heartbeatAt: string | null;
    isFresh: boolean;
  };
  issueRecords: {
    pendingCount: number;
    staleCount: number;
    oldestPendingAt: string | null;
  };
  webhooks: {
    pendingCount: number;
    staleCount: number;
    failedLastHourCount: number;
    oldestPendingAt: string | null;
  };
  ingestion: {
    requestCount: number;
    acceptedEventCount: number;
    rejectedEventCount: number;
    rejectionRatePercent: number;
    serverErrorCount: number;
  };
}

type OperationalDataSource = Pick<DataSource, "query">;
type OperationalRedis = Pick<Redis, "get" | "set">;

/** Worker backlog과 최근 수집 오류를 운영 알림에 적합한 작은 집계로 만듭니다. */
export class OperationalHealthService {
  constructor(
    private readonly dataSource: OperationalDataSource = AppDataSource,
    private readonly redis: OperationalRedis = coreRedis,
  ) {}

  /** 운영 Worker가 살아 있음을 Redis TTL heartbeat로 기록합니다. */
  async recordWorkerHeartbeat(now = new Date()): Promise<void> {
    const ttlSeconds = Math.max(
      30,
      Math.ceil((env.OPERATIONAL_HEALTH_POLL_INTERVAL_MS * 3) / 1_000),
    );
    await this.redis.set(
      WORKER_HEARTBEAT_KEY,
      now.toISOString(),
      "EX",
      ttlSeconds,
    );
  }

  /** 운영 데이터 적체와 최근 실패율을 한 번에 조회합니다. */
  async inspect(now = new Date()): Promise<OperationalHealthSnapshot> {
    const staleAt = new Date(now.getTime() - STALE_JOB_WINDOW_MS);
    const recentAt = new Date(now.getTime() - RECENT_OPERATION_WINDOW_MS);
    const [heartbeatAt, issueRows, webhookRows, usageRows] = await Promise.all([
      this.redis.get(WORKER_HEARTBEAT_KEY),
      this.dataSource.query<CountRow[]>(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE processing.status IN ('RECEIVED', 'EVALUATING', 'FAILED')
            ) AS "pendingCount",
            COUNT(*) FILTER (
              WHERE processing.status = 'EVALUATING'
                AND processing."updatedAt" <= $1
            ) AS "staleCount",
            MIN(processing."updatedAt") FILTER (
              WHERE processing.status IN ('RECEIVED', 'EVALUATING', 'FAILED')
            ) AS "oldestPendingAt"
          FROM "issue_record_processing" processing
        `,
        [staleAt],
      ),
      this.dataSource.query<
        Array<CountRow & { failedLastHourCount: string | number }>
      >(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE delivery.status IN (
                'PENDING',
                'PROCESSING',
                'RETRY_SCHEDULED'
              )
            ) AS "pendingCount",
            COUNT(*) FILTER (
              WHERE delivery.status = 'PROCESSING'
                AND delivery."lockedAt" <= $1
            ) AS "staleCount",
            COUNT(*) FILTER (
              WHERE delivery.status = 'FAILED'
                AND delivery."updatedAt" >= $2
            ) AS "failedLastHourCount",
            MIN(delivery."createdAt") FILTER (
              WHERE delivery.status IN (
                'PENDING',
                'PROCESSING',
                'RETRY_SCHEDULED'
              )
            ) AS "oldestPendingAt"
          FROM "webhook_delivery" delivery
        `,
        [staleAt, recentAt],
      ),
      this.dataSource.query<UsageRow[]>(
        `
          SELECT
            COALESCE(SUM(usage."requestCount"), 0) AS "requestCount",
            COALESCE(SUM(usage."acceptedEventCount"), 0) AS "acceptedEventCount",
            COALESCE(SUM(usage."rejectedEventCount"), 0) AS "rejectedEventCount",
            COALESCE(SUM(usage."serverErrorCount"), 0) AS "serverErrorCount"
          FROM "openapi_api_key_usage_hourly" usage
          WHERE usage."bucketStartedAt" >= $1
        `,
        [recentAt],
      ),
    ]);

    const issue = issueRows[0] ?? emptyCountRow();
    const webhook = webhookRows[0] ?? {
      ...emptyCountRow(),
      failedLastHourCount: 0,
    };
    const usage = usageRows[0] ?? {
      requestCount: 0,
      acceptedEventCount: 0,
      rejectedEventCount: 0,
      serverErrorCount: 0,
    };
    const issuePendingCount = toCount(issue.pendingCount);
    const issueStaleCount = toCount(issue.staleCount);
    const webhookPendingCount = toCount(webhook.pendingCount);
    const webhookStaleCount = toCount(webhook.staleCount);
    const webhookFailedCount = toCount(webhook.failedLastHourCount);
    const acceptedEventCount = toCount(usage.acceptedEventCount);
    const rejectedEventCount = toCount(usage.rejectedEventCount);
    const evaluatedEventCount = acceptedEventCount + rejectedEventCount;
    const rejectionRatePercent =
      evaluatedEventCount === 0
        ? 0
        : roundPercent((rejectedEventCount / evaluatedEventCount) * 100);
    const serverErrorCount = toCount(usage.serverErrorCount);
    const isHeartbeatFresh = this.isHeartbeatFresh(heartbeatAt, now);
    const warnings: string[] = [];

    if (env.WORKER_HEARTBEAT_REQUIRED && !isHeartbeatFresh) {
      warnings.push(OPERATIONAL_WARNING.WORKER_HEARTBEAT_MISSING);
    }
    if (issuePendingCount >= env.ISSUE_RECORD_BACKLOG_WARN_COUNT) {
      warnings.push(OPERATIONAL_WARNING.ISSUE_RECORD_BACKLOG_HIGH);
    }
    if (issueStaleCount >= env.ISSUE_RECORD_STALE_WARN_COUNT) {
      warnings.push(OPERATIONAL_WARNING.ISSUE_RECORD_STALE);
    }
    if (webhookFailedCount >= env.WEBHOOK_FAILED_WARN_COUNT) {
      warnings.push(OPERATIONAL_WARNING.WEBHOOK_FAILURES_HIGH);
    }
    if (webhookStaleCount > 0) {
      warnings.push(OPERATIONAL_WARNING.WEBHOOK_DELIVERY_STALE);
    }
    if (
      evaluatedEventCount >= env.OPENAPI_REJECTION_WARN_MIN_EVENTS &&
      rejectionRatePercent >= env.OPENAPI_REJECTION_WARN_PERCENT
    ) {
      warnings.push(OPERATIONAL_WARNING.OPENAPI_EVENT_REJECTION_HIGH);
    }
    if (serverErrorCount >= env.OPENAPI_SERVER_ERROR_WARN_COUNT) {
      warnings.push(OPERATIONAL_WARNING.OPENAPI_SERVER_ERRORS_HIGH);
    }

    return {
      status: warnings.length > 0 ? "degraded" : "healthy",
      warnings,
      checkedAt: now.toISOString(),
      worker: {
        heartbeatAt,
        isFresh: isHeartbeatFresh,
      },
      issueRecords: {
        pendingCount: issuePendingCount,
        staleCount: issueStaleCount,
        oldestPendingAt: toIsoString(issue.oldestPendingAt),
      },
      webhooks: {
        pendingCount: webhookPendingCount,
        staleCount: webhookStaleCount,
        failedLastHourCount: webhookFailedCount,
        oldestPendingAt: toIsoString(webhook.oldestPendingAt),
      },
      ingestion: {
        requestCount: toCount(usage.requestCount),
        acceptedEventCount,
        rejectedEventCount,
        rejectionRatePercent,
        serverErrorCount,
      },
    };
  }

  /** 공개 readiness에는 내부 건수를 제외하고 상태와 경고 코드만 노출합니다. */
  async getPublicSummary(): Promise<{
    status: "healthy" | "degraded";
    warnings: string[];
    checkedAt: string;
  }> {
    const snapshot = await this.inspect();
    return {
      status: snapshot.status,
      warnings: snapshot.warnings,
      checkedAt: snapshot.checkedAt,
    };
  }

  private isHeartbeatFresh(value: string | null, now: Date): boolean {
    if (!value) return false;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return false;
    return (
      timestamp >= now.getTime() - env.OPERATIONAL_HEALTH_POLL_INTERVAL_MS * 3
    );
  }
}

function emptyCountRow(): CountRow {
  return { pendingCount: 0, staleCount: 0, oldestPendingAt: null };
}

function toCount(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

export const operationalHealthService = new OperationalHealthService();
