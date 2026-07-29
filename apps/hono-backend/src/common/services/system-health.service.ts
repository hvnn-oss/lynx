import type { DataSource } from "typeorm";
import type { Redis } from "ioredis";

import type { ReadinessResponseDto } from "@repo/dto";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { coreRedis } from "../../provider/redis/redis-config.js";
import { env } from "../config/config.js";
import {
  operationalHealthService,
  type OperationalHealthService,
} from "./operational-health.service.js";

type HealthDatabase = Pick<DataSource, "isInitialized" | "query">;
type HealthRedis = Pick<Redis, "ping">;
type PublicOperationalHealth = Pick<
  OperationalHealthService,
  "getPublicSummary"
>;

/** 컨테이너가 요청을 처리할 수 있는지 핵심 의존성까지 확인합니다. */
export class SystemHealthService {
  constructor(
    private readonly database: HealthDatabase = AppDataSource,
    private readonly redis: HealthRedis = coreRedis,
    private readonly operations: PublicOperationalHealth = operationalHealthService,
  ) {}

  /** PostgreSQL과 Redis를 제한 시간 안에 확인해 readiness 결과를 만듭니다. */
  async checkReadiness(): Promise<ReadinessResponseDto> {
    const [database, redis] = await Promise.all([
      this.checkDependency(async () => {
        if (!this.database.isInitialized) throw new Error("DB_NOT_INITIALIZED");
        await this.database.query("SELECT 1");
      }),
      this.checkDependency(async () => {
        await this.redis.ping();
      }),
    ]);

    const operationSummary =
      database.status === "up" && redis.status === "up"
        ? await this.operations.getPublicSummary().catch(() => ({
            status: "unknown" as const,
            warnings: ["OPERATIONAL_HEALTH_CHECK_FAILED"],
            checkedAt: new Date().toISOString(),
          }))
        : {
            status: "unknown" as const,
            warnings: ["DEPENDENCY_UNAVAILABLE"],
            checkedAt: new Date().toISOString(),
          };

    return {
      status:
        database.status === "up" && redis.status === "up"
          ? "ok"
          : "unavailable",
      processRole: env.LYNX_PROCESS_ROLE,
      checks: { database, redis },
      operations: operationSummary,
      retentionEnabled: env.DATA_RETENTION_ENABLED,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDependency(
    check: () => Promise<void>,
  ): Promise<ReadinessResponseDto["checks"]["database"]> {
    const startedAt = Date.now();
    try {
      await withTimeout(check(), env.HEALTH_CHECK_TIMEOUT_MS);
      return { status: "up", latencyMs: Date.now() - startedAt };
    } catch {
      return { status: "down", latencyMs: Date.now() - startedAt };
    }
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("HEALTH_CHECK_TIMEOUT")),
      timeoutMs,
    );
    timeout.unref?.();
    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export const systemHealthService = new SystemHealthService();
