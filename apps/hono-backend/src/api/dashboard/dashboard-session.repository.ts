import type { DashboardSessionScope } from "@repo/dto";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import type {
  DashboardSessionEventRow,
  DashboardSessionMetricsRow,
  DashboardSessionRow,
  IngestionHourlyRow,
} from "./dashboard.repository.js";

/** Session 요약 화면과 상세 화면에 필요한 조회만 담당합니다. */
export class DashboardSessionRepository {
  async getMetrics(
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<DashboardSessionMetricsRow> {
    const rows = (await AppDataSource.query(
      `
        ${this.sessionRollupCte()}
        SELECT
          COUNT(*)::text AS "sessionCount",
          COUNT(*) FILTER (WHERE rollup.status = 'COMPLETED')::text AS "completedCount",
          COUNT(*) FILTER (WHERE rollup.status = 'FAILED')::text AS "failedCount",
          COUNT(*) FILTER (WHERE rollup.status = 'RUNNING')::text AS "runningCount",
          AVG(rollup."durationMs") FILTER (
            WHERE rollup."durationMs" IS NOT NULL
          )::text AS "averageDurationMs",
          AVG(rollup.cost)::text AS "averageCost",
          COALESCE(SUM(rollup."blockedCount"), 0)::text AS "blockedCount"
        FROM rollup
        WHERE rollup."startedAt" >= now() - interval '24 hours'
          ${this.scopeCondition(scope)}
      `,
      [workspaceId],
    )) as DashboardSessionMetricsRow[];

    return (
      rows[0] ?? {
        sessionCount: "0",
        completedCount: "0",
        failedCount: "0",
        runningCount: "0",
        averageDurationMs: null,
        averageCost: null,
        blockedCount: "0",
      }
    );
  }

  getSessions(
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<DashboardSessionRow[]> {
    return AppDataSource.query(
      `
        ${this.sessionRollupCte()}
        SELECT *
        FROM rollup
        WHERE rollup."startedAt" >= now() - interval '24 hours'
          ${this.scopeCondition(scope)}
        ORDER BY rollup."startedAt" DESC, rollup.id DESC
        LIMIT 8
      `,
      [workspaceId],
    );
  }

  getHourlyVolume(
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<IngestionHourlyRow[]> {
    return AppDataSource.query(
      `
        ${this.sessionRollupCte()},
        filtered AS (
          SELECT *
          FROM rollup
          WHERE rollup."startedAt" >= date_trunc('hour', now()) - interval '23 hours'
            ${this.scopeCondition(scope)}
        )
        SELECT
          bucket AS "timestamp",
          COUNT(filtered.id)::text AS "count"
        FROM generate_series(
          date_trunc('hour', now()) - interval '23 hours',
          date_trunc('hour', now()),
          interval '1 hour'
        ) bucket
        LEFT JOIN filtered
          ON filtered."startedAt" >= bucket
          AND filtered."startedAt" < bucket + interval '1 hour'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      [workspaceId],
    );
  }

  async getDetail(workspaceId: string, sessionId: string) {
    const [sessions, events, issueRows] = await Promise.all([
      AppDataSource.query(
        `
          ${this.sessionRollupCte()}
          SELECT * FROM rollup WHERE rollup.id = $2
        `,
        [workspaceId, sessionId],
      ) as Promise<DashboardSessionRow[]>,
      AppDataSource.query(
        `
          SELECT
            event.id,
            event."clientEventId",
            event."eventType",
            event.label,
            event.timestamp,
            event.latency,
            event.cost,
            event.payload
          FROM "event" event
          INNER JOIN "session" session ON session.id = event."sessionId"
          WHERE session."workspaceId" = $1
            AND session.id = $2
          ORDER BY event.timestamp ASC, event."createdAt" ASC, event.id ASC
          LIMIT 101
        `,
        [workspaceId, sessionId],
      ) as Promise<DashboardSessionEventRow[]>,
      AppDataSource.query(
        `
          SELECT COUNT(*)::text AS "count"
          FROM "issue_occurrence"
          WHERE "workspaceId" = $1 AND "sessionId" = $2
        `,
        [workspaceId, sessionId],
      ) as Promise<Array<{ count: string }>>,
    ]);

    return {
      session: sessions[0] ?? null,
      events,
      issueCount: Number(issueRows[0]?.count ?? 0),
    };
  }

  /** Run 원본을 Session 단위의 한 행으로 집계합니다. */
  private sessionRollupCte(): string {
    return `
      WITH rollup AS (
        SELECT
          session.id,
          COALESCE(session."clientSessionId", session.id::text) AS "sessionId",
          session.name,
          CASE
            WHEN BOOL_OR(run.status = 'FAILED') THEN 'FAILED'
            WHEN BOOL_OR(run.status = 'RUNNING') THEN 'RUNNING'
            WHEN BOOL_OR(run.status = 'CANCELLED') THEN 'CANCELLED'
            ELSE 'COMPLETED'
          END AS status,
          MIN(run."startedAt") AS "startedAt",
          CASE
            WHEN BOOL_OR(run."endedAt" IS NULL) THEN NULL
            ELSE MAX(run."endedAt")
          END AS "endedAt",
          CASE
            WHEN BOOL_OR(run."endedAt" IS NULL) THEN NULL
            ELSE EXTRACT(
              EPOCH FROM (MAX(run."endedAt") - MIN(run."startedAt"))
            ) * 1000
          END AS "durationMs",
          COALESCE(SUM(run."totalCost"), 0) AS cost,
          COALESCE(SUM(run."totalTokens"), 0)::text AS "totalTokens",
          COUNT(DISTINCT run.id)::text AS "runCount",
          agent.id AS "agentId",
          agent.name AS "agentName",
          (
            SELECT COUNT(*)
            FROM "firewall-violation" violation
            WHERE violation."sessionId" = session.id
          ) AS "blockedCount"
        FROM "session" session
        INNER JOIN "run" run ON run."sessionId" = session.id
        INNER JOIN "agent" agent ON agent.id = session."agentId"
        WHERE run."workspaceId" = $1
        GROUP BY session.id, session."clientSessionId", session.name, agent.id, agent.name
      )
    `;
  }

  private scopeCondition(scope: DashboardSessionScope): string {
    if (scope === "COMPLETED") return "AND rollup.status = 'COMPLETED'";
    if (scope === "FAILED") return "AND rollup.status = 'FAILED'";
    return "";
  }
}

export const dashboardSessionRepository = new DashboardSessionRepository();
