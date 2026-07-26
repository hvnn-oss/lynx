import { AppDataSource } from "../../provider/database/typeorm-config.js";

export interface DashboardKpiRow {
  runCount: string;
  completedRunCount: string;
  issueCount: string;
  criticalIssues: string;
  warningIssues: string;
  firewallBlocked: string;
}

export interface DashboardTrendRow {
  date: string;
  count: string;
}

export interface DashboardIssueRow {
  id: string;
  title: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
}

/** Provides bounded aggregate queries for the dashboard first screen. */
export class DashboardRepository {
  async getKpis(workspaceId: string): Promise<DashboardKpiRow> {
    const rows = (await AppDataSource.query(
      `
        SELECT
          (SELECT COUNT(*) FROM "run" WHERE "workspaceId" = $1) AS "runCount",
          (SELECT COUNT(*) FROM "run" WHERE "workspaceId" = $1 AND "status" = 'COMPLETED') AS "completedRunCount",
          (SELECT COUNT(*) FROM "issue" WHERE "workspaceId" = $1) AS "issueCount",
          (SELECT COUNT(*) FROM "issue" WHERE "workspaceId" = $1 AND "status" IN ('OPEN', 'INVESTIGATING') AND "severity" = 'CRITICAL') AS "criticalIssues",
          (SELECT COUNT(*) FROM "issue" WHERE "workspaceId" = $1 AND "status" IN ('OPEN', 'INVESTIGATING') AND "severity" = 'WARNING') AS "warningIssues",
          (SELECT COALESCE(SUM("blockedOccurrenceCount"), 0) FROM "issue" WHERE "workspaceId" = $1) AS "firewallBlocked"
      `,
      [workspaceId],
    )) as DashboardKpiRow[];

    return (
      rows[0] ?? {
        runCount: "0",
        completedRunCount: "0",
        issueCount: "0",
        criticalIssues: "0",
        warningIssues: "0",
        firewallBlocked: "0",
      }
    );
  }

  getIssueTrend(workspaceId: string): Promise<DashboardTrendRow[]> {
    return AppDataSource.query(
      `
        SELECT day::date::text AS "date", COUNT(occurrence.id)::text AS "count"
        FROM generate_series(
          date_trunc('day', now()) - interval '6 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS day
        LEFT JOIN "issue_occurrence" occurrence
          ON occurrence."workspaceId" = $1
          AND occurrence."detectedAt" >= day
          AND occurrence."detectedAt" < day + interval '1 day'
        GROUP BY day
        ORDER BY day ASC
      `,
      [workspaceId],
    );
  }

  getImportantIssues(workspaceId: string): Promise<DashboardIssueRow[]> {
    return AppDataSource.query(
      `
        SELECT "id", "title", "severity"
        FROM "issue"
        WHERE "workspaceId" = $1
          AND "status" IN ('OPEN', 'INVESTIGATING')
        ORDER BY
          CASE "severity" WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
          "lastSeenAt" DESC,
          "id" DESC
        LIMIT 5
      `,
      [workspaceId],
    );
  }
}

export const dashboardRepository = new DashboardRepository();
