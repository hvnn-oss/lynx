import { env } from "../config/config.js";
import { logger } from "../logger/logger.js";
import {
  DataRetentionRepository,
  dataRetentionRepository,
  type DataRetentionBatchResult,
} from "./data-retention.repository.js";

export interface DataRetentionRunResult extends DataRetentionBatchResult {
  batches: number;
  isEnabled: boolean;
}

/** 보존 기간이 지난 실행 데이터 삭제를 제한된 작업량으로 조정합니다. */
export class DataRetentionService {
  constructor(
    private readonly repository: DataRetentionRepository = dataRetentionRepository,
  ) {}

  /** 한 번의 보존 주기에서 설정된 최대 배치까지만 삭제합니다. */
  async runOnce(): Promise<DataRetentionRunResult> {
    if (!env.DATA_RETENTION_ENABLED) {
      return {
        batches: 0,
        deletedAuditLogs: 0,
        deletedIssueRecords: 0,
        deletedOpenApiUsageBuckets: 0,
        deletedSessions: 0,
        isEnabled: false,
      };
    }

    let batches = 0;
    let deletedAuditLogs = 0;
    let deletedIssueRecords = 0;
    let deletedOpenApiUsageBuckets = 0;
    let deletedSessions = 0;
    const now = Date.now();
    const cutoffs = {
      auditLogsBefore: new Date(
        now - env.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60_000,
      ),
      openApiUsageBefore: new Date(
        now - env.OPENAPI_USAGE_RETENTION_DAYS * 24 * 60 * 60_000,
      ),
    };

    while (batches < env.DATA_RETENTION_MAX_BATCHES_PER_RUN) {
      const batch = await this.repository.purgeBatch(
        env.DATA_RETENTION_BATCH_SIZE,
        cutoffs,
      );
      batches += 1;
      deletedAuditLogs += batch.deletedAuditLogs;
      deletedIssueRecords += batch.deletedIssueRecords;
      deletedOpenApiUsageBuckets += batch.deletedOpenApiUsageBuckets;
      deletedSessions += batch.deletedSessions;

      if (
        batch.deletedAuditLogs < env.DATA_RETENTION_BATCH_SIZE &&
        batch.deletedIssueRecords < env.DATA_RETENTION_BATCH_SIZE &&
        batch.deletedOpenApiUsageBuckets < env.DATA_RETENTION_BATCH_SIZE &&
        batch.deletedSessions < env.DATA_RETENTION_BATCH_SIZE
      ) {
        break;
      }
    }

    if (
      deletedAuditLogs > 0 ||
      deletedIssueRecords > 0 ||
      deletedOpenApiUsageBuckets > 0 ||
      deletedSessions > 0
    ) {
      logger.info(
        {
          event: "data_retention.completed",
          batches,
          deletedAuditLogs,
          deletedIssueRecords,
          deletedOpenApiUsageBuckets,
          deletedSessions,
        },
        "expired workspace data removed",
      );
    }

    return {
      batches,
      deletedAuditLogs,
      deletedIssueRecords,
      deletedOpenApiUsageBuckets,
      deletedSessions,
      isEnabled: true,
    };
  }
}

export const dataRetentionService = new DataRetentionService();
