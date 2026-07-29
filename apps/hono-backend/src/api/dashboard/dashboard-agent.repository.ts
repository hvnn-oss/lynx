import type { DashboardAgentScope } from "@repo/dto";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import type {
  DashboardAgentDetailRow,
  DashboardAgentIssueRow,
  DashboardAgentMetricsRow,
  DashboardAgentRow,
  DashboardAgentRunRow,
  DashboardAgentVolumeRow,
} from "./dashboard.repository.js";

/** Agent 상태 요약과 단일 Agent 상세 조회를 담당합니다. */
export class DashboardAgentRepository {
  async getMetrics(
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentMetricsRow> {
    const rows = (await AppDataSource.query(
      `
        ${this.agentRollupCte()}
        SELECT
          COUNT(*)::text AS "agentCount",
          COUNT(*) FILTER (WHERE rollup.status = 'ACTIVE')::text AS "activeCount",
          COUNT(*) FILTER (WHERE rollup.status = 'INACTIVE')::text AS "inactiveCount",
          COALESCE(SUM(rollup."runningRunCount"), 0)::text AS "runningRunCount",
          COALESCE(SUM(rollup."failedRunCount"), 0)::text AS "failedRunCount"
        FROM rollup
        WHERE TRUE ${this.scopeCondition(scope)}
      `,
      [workspaceId],
    )) as DashboardAgentMetricsRow[];

    return (
      rows[0] ?? {
        agentCount: "0",
        activeCount: "0",
        inactiveCount: "0",
        runningRunCount: "0",
        failedRunCount: "0",
      }
    );
  }

  getAgents(
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentRow[]> {
    return AppDataSource.query(
      `
        ${this.agentRollupCte()}
        SELECT *
        FROM rollup
        WHERE TRUE ${this.scopeCondition(scope)}
        ORDER BY
          rollup."failedRunCount" DESC,
          rollup."runningRunCount" DESC,
          rollup."lastRunAt" DESC NULLS LAST,
          rollup.id DESC
        LIMIT 8
      `,
      [workspaceId],
    );
  }

  getRunVolume(
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentVolumeRow[]> {
    return AppDataSource.query(
      `
        ${this.agentRollupCte()}
        SELECT
          rollup.id AS "agentId",
          rollup.name AS "agentName",
          rollup."recentRunCount"::text AS "count"
        FROM rollup
        WHERE TRUE ${this.scopeCondition(scope)}
        ORDER BY rollup."recentRunCount" DESC, rollup.name ASC
        LIMIT 8
      `,
      [workspaceId],
    );
  }

  async getDetail(workspaceId: string, agentId: string) {
    const [agents, recentRuns, recentIssues] = await Promise.all([
      AppDataSource.query(
        `
          SELECT
            agent.id,
            agent.name,
            agent.description,
            agent."defaultModel",
            MAX(run."startedAt") AS "lastRunAt",
            COUNT(run.id)::text AS "runCount",
            COUNT(run.id) FILTER (
              WHERE run.status = 'COMPLETED'
            )::text AS "completedRunCount",
            COUNT(run.id) FILTER (
              WHERE run.status = 'FAILED'
            )::text AS "failedRunCount",
            COALESCE(SUM(run."totalCost"), 0)::text AS "totalCost",
            COALESCE(SUM(run."totalTokens"), 0)::text AS "totalTokens"
          FROM "agent" agent
          LEFT JOIN "run" run ON run."agentId" = agent.id
          WHERE agent."workspaceId" = $1 AND agent.id = $2
          GROUP BY agent.id, agent.name, agent.description, agent."defaultModel"
        `,
        [workspaceId, agentId],
      ) as Promise<DashboardAgentDetailRow[]>,
      AppDataSource.query(
        `
          SELECT
            run.id,
            run."clientRunId" AS "runId",
            run.status,
            run."startedAt",
            run."totalCost" AS cost,
            run."totalTokens"
          FROM "run" run
          WHERE run."workspaceId" = $1 AND run."agentId" = $2
          ORDER BY run."startedAt" DESC, run.id DESC
          LIMIT 8
        `,
        [workspaceId, agentId],
      ) as Promise<DashboardAgentRunRow[]>,
      AppDataSource.query(
        `
          SELECT id, title, severity, "lastSeenAt"
          FROM "issue"
          WHERE "workspaceId" = $1
            AND "agentId" = $2
            AND status IN ('OPEN', 'INVESTIGATING')
          ORDER BY
            CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
            "lastSeenAt" DESC
          LIMIT 5
        `,
        [workspaceId, agentId],
      ) as Promise<DashboardAgentIssueRow[]>,
    ]);

    return {
      agent: agents[0] ?? null,
      recentRuns,
      recentIssues,
    };
  }

  /** 등록 Agent와 최근 24시간 Run을 한 행으로 집계합니다. */
  private agentRollupCte(): string {
    return `
      WITH rollup AS (
        SELECT
          agent.id,
          agent.name,
          agent."defaultModel",
          CASE
            WHEN MAX(run."startedAt") >= now() - interval '24 hours'
              THEN 'ACTIVE'
            ELSE 'INACTIVE'
          END AS status,
          MAX(run."startedAt") AS "lastRunAt",
          COUNT(run.id) FILTER (
            WHERE run."startedAt" >= now() - interval '24 hours'
          )::int AS "recentRunCount",
          COUNT(run.id) FILTER (
            WHERE run."startedAt" >= now() - interval '24 hours'
              AND run.status = 'RUNNING'
          )::int AS "runningRunCount",
          COUNT(run.id) FILTER (
            WHERE run."startedAt" >= now() - interval '24 hours'
              AND run.status = 'FAILED'
          )::int AS "failedRunCount",
          COALESCE(SUM(run."totalCost") FILTER (
            WHERE run."startedAt" >= now() - interval '24 hours'
          ), 0)::text AS "recentCost"
        FROM "agent" agent
        LEFT JOIN "run" run ON run."agentId" = agent.id
        WHERE agent."workspaceId" = $1
        GROUP BY agent.id, agent.name, agent."defaultModel"
      )
    `;
  }

  private scopeCondition(scope: DashboardAgentScope): string {
    if (scope === "ACTIVE") return "AND rollup.status = 'ACTIVE'";
    if (scope === "INACTIVE") return "AND rollup.status = 'INACTIVE'";
    return "";
  }
}

export const dashboardAgentRepository = new DashboardAgentRepository();
