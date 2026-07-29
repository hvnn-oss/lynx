import { env } from "../config/config.js";
import type { DataRetentionRepository } from "./data-retention.repository.js";
import { DataRetentionService } from "./data-retention.service.js";

describe("DataRetentionService", () => {
  const originalEnabled = env.DATA_RETENTION_ENABLED;
  const originalBatchSize = env.DATA_RETENTION_BATCH_SIZE;
  const originalMaxBatches = env.DATA_RETENTION_MAX_BATCHES_PER_RUN;

  afterEach(() => {
    env.DATA_RETENTION_ENABLED = originalEnabled;
    env.DATA_RETENTION_BATCH_SIZE = originalBatchSize;
    env.DATA_RETENTION_MAX_BATCHES_PER_RUN = originalMaxBatches;
  });

  it("비활성화 상태에서는 저장소를 호출하지 않는다", async () => {
    env.DATA_RETENTION_ENABLED = false;
    const purgeBatch = jest.fn();
    const service = new DataRetentionService({
      purgeBatch,
    } as unknown as DataRetentionRepository);

    await expect(service.runOnce()).resolves.toEqual({
      batches: 0,
      deletedIssueRecords: 0,
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
        deletedIssueRecords: 10,
        deletedSessions: 10,
      })
      .mockResolvedValueOnce({
        deletedIssueRecords: 2,
        deletedSessions: 1,
      });
    const service = new DataRetentionService({
      purgeBatch,
    } as unknown as DataRetentionRepository);

    await expect(service.runOnce()).resolves.toEqual({
      batches: 2,
      deletedIssueRecords: 12,
      deletedSessions: 11,
      isEnabled: true,
    });
    expect(purgeBatch).toHaveBeenCalledTimes(2);
    expect(purgeBatch).toHaveBeenCalledWith(10);
  });
});
