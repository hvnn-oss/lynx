import type { DataSource, EntityManager } from "typeorm";

import { DataRetentionRepository } from "./data-retention.repository.js";

describe("DataRetentionRepository", () => {
  it("만료 Session 삭제 후 영향받은 Issue 집계를 다시 계산한다", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ id: "session-1" }])
      .mockResolvedValueOnce([{ issueId: "issue-1" }])
      .mockResolvedValueOnce([{ id: "session-1" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id: "record-1" }]);
    const manager = { query } as unknown as EntityManager;
    const transaction = jest
      .fn()
      .mockImplementation(async (work) => work(manager));
    const repository = new DataRetentionRepository({
      transaction,
    } as unknown as DataSource);

    await expect(repository.purgeBatch(100)).resolves.toEqual({
      deletedIssueRecords: 1,
      deletedSessions: 1,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain(
      'make_interval(days => GREATEST(plan."retentionDays", 1))',
    );
    expect(query.mock.calls[3]?.[0]).toContain('"occurrenceCount"');
    expect(query.mock.calls[4]?.[0]).toContain('DELETE FROM "issue_record"');
  });

  it("삭제할 Session이 없어도 Issue Record 보존 정책은 적용한다", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "record-1" }, { id: "record-2" }]);
    const manager = { query } as unknown as EntityManager;
    const repository = new DataRetentionRepository({
      transaction: jest.fn().mockImplementation(async (work) => work(manager)),
    } as unknown as DataSource);

    await expect(repository.purgeBatch(100)).resolves.toEqual({
      deletedIssueRecords: 2,
      deletedSessions: 0,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
