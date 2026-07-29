import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { DashboardSessionRepository } from "./dashboard-session.repository.js";

describe("DashboardSessionRepository", () => {
  afterEach(() => jest.restoreAllMocks());

  it("filters and buckets sessions by their latest activity", async () => {
    const query = jest.spyOn(AppDataSource, "query").mockResolvedValue([]);
    const repository = new DashboardSessionRepository();

    await repository.getSessions("workspace-1", "ALL");
    await repository.getHourlyVolume("workspace-1", "FAILED");

    const listSql = String(query.mock.calls[0]?.[0]);
    const hourlySql = String(query.mock.calls[1]?.[0]);

    expect(listSql).toContain(
      `rollup."lastActivityAt" >= now() - interval '24 hours'`,
    );
    expect(listSql).toContain(`ORDER BY rollup."lastActivityAt" DESC`);
    expect(hourlySql).toContain(
      `rollup."lastActivityAt" >= date_trunc('hour', now()) - interval '23 hours'`,
    );
    expect(hourlySql).toContain(`rollup.status = 'FAILED'`);
  });

  it("separates summed run time from wall-clock elapsed time", async () => {
    const query = jest.spyOn(AppDataSource, "query").mockResolvedValue([]);
    const repository = new DashboardSessionRepository();

    await repository.getSessions("workspace-1", "ALL");

    const sql = String(query.mock.calls[0]?.[0]);

    expect(sql).toContain(`SUM(`);
    expect(sql).toContain(`run."endedAt" - run."startedAt"`);
    expect(sql).toContain(`MAX(run."endedAt") - MIN(run."startedAt")`);
    expect(sql).toContain(`AS "elapsedDurationMs"`);
  });

  it("uses stored event time when it is newer than the latest run boundary", async () => {
    const query = jest.spyOn(AppDataSource, "query").mockResolvedValue([]);
    const repository = new DashboardSessionRepository();

    await repository.getSessions("workspace-1", "ALL");

    const sql = String(query.mock.calls[0]?.[0]);

    expect(sql).toContain(`SELECT MAX(event.timestamp)`);
    expect(sql).toContain(`event."sessionId" = session.id`);
  });
});
