import { env } from "../config/config.js";
import type { DataRetentionRepository } from "./data-retention.repository.js";
import { DataRetentionService } from "./data-retention.service.js";

describe("DataRetentionService", () => {
  const originalEnabled = env.DATA_RETENTION_ENABLED;
  const originalBatchSize = env.DATA_RETENTION_BATCH_SIZE;
  const originalMaxBatches = env.DATA_RETENTION_MAX_BATCHES_PER_RUN;
  const originalAuditRetentionDays = env.AUDIT_LOG_RETENTION_DAYS;
  const originalUsageRetentionDays = env.OPENAPI_USAGE_RETENTION_DAYS;

  afterEach(() => {
    env.DATA_RETENTION_ENABLED = originalEnabled;
    env.DATA_RETENTION_BATCH_SIZE = originalBatchSize;
    env.DATA_RETENTION_MAX_BATCHES_PER_RUN = originalMaxBatches;
    env.AUDIT_LOG_RETENTION_DAYS = originalAuditRetentionDays;
    env.OPENAPI_USAGE_RETENTION_DAYS = originalUsageRetentionDays;
  });

  it("비활성화 상태에서는 저장소를 호출하지 않는다", async () => {
    env.DATA_RETENTION_ENABLED = false;
    const purgeBatch = jest.fn();
    const service = new DataRetentionService({
      purgeBatch,
    } as unknown as DataRetentionRepository);

    await expect(service.runOnce()).resolves.toEqual({
      batches: 0,
      deletedAuditLogs: 0,
      deletedIssueRecords: 0,
      deletedOpenApiUsageBuckets: 0,
      deletedSessions: 0,
      isEnabled: false,
    });
    expect(purgeBatch).not.toHaveBeenCalled();
  });

  it("가득 찬 배치가 이어지는 동안 제한 범위에서 정리를 반복한다", async () => {
    env.DATA_RETENTION_ENABLED = true;
    env.DATA_RETENTION_BATCH_SIZE = 10;
    env.DATA_RETENTION_MAX_BATCHES_PER_RUN = 3;
    const purgeBatch = jest
      .fn()
      .mockResolvedValueOnce({
        deletedAuditLogs: 10,
        deletedIssueRecords: 10,
        deletedOpenApiUsageBuckets: 10,
        deletedSessions: 10,
      })
      .mockResolvedValueOnce({
        deletedAuditLogs: 3,
        deletedIssueRecords: 2,
        deletedOpenApiUsageBuckets: 4,
        deletedSessions: 1,
      });
    const service = new DataRetentionService({
      purgeBatch,
    } as unknown as DataRetentionRepository);

    await expect(service.runOnce()).resolves.toEqual({
      batches: 2,
      deletedAuditLogs: 13,
      deletedIssueRecords: 12,
      deletedOpenApiUsageBuckets: 14,
      deletedSessions: 11,
      isEnabled: true,
    });
    expect(purgeBatch).toHaveBeenCalledTimes(2);
    expect(purgeBatch).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        auditLogsBefore: expect.any(Date),
        openApiUsageBefore: expect.any(Date),
      }),
    );
  });
});
