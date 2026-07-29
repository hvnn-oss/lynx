import { AppDataSource } from "../../provider/database/typeorm-config.js";
import type {
  DashboardAgentCostRow,
  DashboardCostMetricsRow,
  DashboardDailyCostRow,
} from "./dashboard.repository.js";

/** 비용 화면에 필요한 기간별 Run 비용 집계만 담당합니다. */
export class DashboardCostRepository {
  async getMetrics(workspaceId: string): Promise<DashboardCostMetricsRow> {
    const rows = (await AppDataSource.query(
      `
        SELECT
          COALESCE(SUM(run."totalCost") FILTER (
            WHERE run."startedAt" >= date_trunc('day', now())
          ), 0)::text AS "today",
          COALESCE(SUM(run."totalCost") FILTER (
            WHERE run."startedAt" >= date_trunc('week', now())
          ), 0)::text AS "thisWeek",
          COALESCE(SUM(run."totalCost") FILTER (
            WHERE run."startedAt" >= date_trunc('month', now())
          ), 0)::text AS "thisMonth",
          COUNT(*) FILTER (
            WHERE run."startedAt" >= date_trunc('month', now())
          )::text AS "monthRunCount",
          COALESCE(SUM(run."totalTokens") FILTER (
            WHERE run."startedAt" >= date_trunc('month', now())
          ), 0)::text AS "totalTokensThisMonth",
          (
            SELECT COUNT(*)
            FROM "event" cost_event
            INNER JOIN "run" cost_run ON cost_run.id = cost_event."runId"
            WHERE cost_run."workspaceId" = $1
              AND cost_run."startedAt" >= date_trunc('month', now())
              AND cost_event."eventType" = 'LLM_CALL'
              AND cost_event.payload->>'phase' = 'end'
          )::text AS "totalLlmCalls",
          (
            SELECT COUNT(cost_event.cost)
            FROM "event" cost_event
            INNER JOIN "run" cost_run ON cost_run.id = cost_event."runId"
            WHERE cost_run."workspaceId" = $1
              AND cost_run."startedAt" >= date_trunc('month', now())
              AND cost_event."eventType" = 'LLM_CALL'
              AND cost_event.payload->>'phase' = 'end'
          )::text AS "pricedLlmCalls",
          (
            SELECT COUNT(*)
            FROM "event" cost_event
            INNER JOIN "run" cost_run ON cost_run.id = cost_event."runId"
            WHERE cost_run."workspaceId" = $1
              AND cost_run."startedAt" >= date_trunc('month', now())
              AND cost_event."eventType" = 'LLM_CALL'
              AND cost_event.payload->>'phase' = 'end'
              AND cost_event.payload->>'costSource' IN (
                'CLIENT_ESTIMATED',
                'SERVER_ESTIMATED'
              )
          )::text AS "estimatedLlmCalls"
        FROM "run" run
        WHERE run."workspaceId" = $1
      `,
      [workspaceId],
    )) as DashboardCostMetricsRow[];

    return (
      rows[0] ?? {
        today: "0",
        thisWeek: "0",
        thisMonth: "0",
        monthRunCount: "0",
        totalTokensThisMonth: "0",
        totalLlmCalls: "0",
        pricedLlmCalls: "0",
        estimatedLlmCalls: "0",
      }
    );
  }

  getDailyCost(workspaceId: string): Promise<DashboardDailyCostRow[]> {
    return AppDataSource.query(
      `
        SELECT
          day::date::text AS "date",
          COALESCE(SUM(run."totalCost"), 0)::text AS "cost"
        FROM generate_series(
          date_trunc('day', now()) - interval '13 days',
          date_trunc('day', now()),
          interval '1 day'
        ) day
        LEFT JOIN "run" run
          ON run."workspaceId" = $1
          AND run."startedAt" >= day
          AND run."startedAt" < day + interval '1 day'
        GROUP BY day
        ORDER BY day ASC
      `,
      [workspaceId],
    );
  }

  getTopAgentCosts(workspaceId: string): Promise<DashboardAgentCostRow[]> {
    return AppDataSource.query(
      `
        SELECT
          agent.id AS "agentId",
          agent.name AS "agentName",
          COALESCE(SUM(run."totalCost"), 0)::text AS "cost",
          COUNT(run.id)::text AS "runCount",
          COALESCE(SUM(run."totalTokens"), 0)::text AS "totalTokens"
        FROM "run" run
        INNER JOIN "agent" agent ON agent.id = run."agentId"
        WHERE run."workspaceId" = $1
          AND run."startedAt" >= date_trunc('month', now())
        GROUP BY agent.id, agent.name
        ORDER BY SUM(run."totalCost") DESC, COUNT(run.id) DESC
        LIMIT 8
      `,
      [workspaceId],
    );
  }
}

export const dashboardCostRepository = new DashboardCostRepository();
