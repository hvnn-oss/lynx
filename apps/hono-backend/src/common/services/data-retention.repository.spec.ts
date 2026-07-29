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
      .mockResolvedValueOnce([{ id: "record-1" }])
      .mockResolvedValueOnce([{ id: "audit-1" }])
      .mockResolvedValueOnce([{ id: "usage-1" }]);
    const manager = { query } as unknown as EntityManager;
    const transaction = jest
      .fn()
      .mockImplementation(async (work) => work(manager));
    const repository = new DataRetentionRepository({
      transaction,
    } as unknown as DataSource);

    await expect(
      repository.purgeBatch(100, {
        auditLogsBefore: new Date("2025-01-01T00:00:00.000Z"),
        openApiUsageBefore: new Date("2025-02-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      deletedAuditLogs: 1,
      deletedIssueRecords: 1,
      deletedOpenApiUsageBuckets: 1,
      deletedSessions: 1,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain(
      'make_interval(days => GREATEST(plan."retentionDays", 1))',
    );
    expect(query.mock.calls[3]?.[0]).toContain('"occurrenceCount"');
    expect(query.mock.calls[4]?.[0]).toContain('DELETE FROM "issue_record"');
    expect(query.mock.calls[5]?.[0]).toContain('DELETE FROM "admin_audit_log"');
    expect(query.mock.calls[6]?.[0]).toContain(
      'DELETE FROM "openapi_api_key_usage_hourly"',
    );
  });

  it("삭제할 Session이 없어도 Issue Record 보존 정책은 적용한다", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "record-1" }, { id: "record-2" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const manager = { query } as unknown as EntityManager;
    const repository = new DataRetentionRepository({
      transaction: jest.fn().mockImplementation(async (work) => work(manager)),
    } as unknown as DataSource);

    await expect(
      repository.purgeBatch(100, {
        auditLogsBefore: new Date(),
        openApiUsageBefore: new Date(),
      }),
    ).resolves.toEqual({
      deletedAuditLogs: 0,
      deletedIssueRecords: 2,
      deletedOpenApiUsageBuckets: 0,
      deletedSessions: 0,
    });
    expect(query).toHaveBeenCalledTimes(4);
  });
});
