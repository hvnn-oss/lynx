import type { DashboardAgentScope, DashboardSessionScope } from "@repo/dto";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import {
  DashboardAgentRepository,
  dashboardAgentRepository,
} from "./dashboard-agent.repository.js";
import {
  DashboardCostRepository,
  dashboardCostRepository,
} from "./dashboard-cost.repository.js";
import {
  DashboardSessionRepository,
  dashboardSessionRepository,
} from "./dashboard-session.repository.js";

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

export interface IngestionSummaryRow {
  lastStoredAt: Date | string | null;
  storedEvents: string;
  activeRuns: string;
  activeAgents: string;
  p95StorageDelayMs: string | null;
}

export interface IngestionHourlyRow {
  timestamp: Date | string;
  count: string;
}

export interface IngestionSourceRow {
  agentId: string;
  agentName: string;
  environment: string;
  eventCount: string;
  lastStoredAt: Date | string;
}

export interface IngestionEventTypeRow {
  eventType: string;
  count: string;
}

export interface DashboardSessionMetricsRow {
  sessionCount: string;
  completedCount: string;
  failedCount: string;
  runningCount: string;
  averageDurationMs: string | null;
  averageElapsedDurationMs: string | null;
  averageCost: string | null;
  blockedCount: string;
}

export interface DashboardSessionRow {
  id: string;
  sessionId: string;
  name: string;
  status: string;
  startedAt: Date | string;
  lastActivityAt: Date | string;
  endedAt: Date | string | null;
  durationMs: string | null;
  elapsedDurationMs: string | null;
  cost: string;
  runCount: string;
  totalTokens?: string;
  agentId: string;
  agentName: string;
}

export interface DashboardSessionEventRow {
  id: string;
  clientEventId: string | null;
  eventType: string;
  label: string;
  timestamp: Date | string;
  latency: number | null;
  cost: string | null;
  payload: Record<string, unknown>;
}

export interface DashboardAgentMetricsRow {
  agentCount: string;
  activeCount: string;
  inactiveCount: string;
  runningRunCount: string;
  failedRunCount: string;
}

export interface DashboardAgentRow {
  id: string;
  name: string;
  defaultModel: string;
  status: "ACTIVE" | "INACTIVE";
  lastRunAt: Date | string | null;
  recentRunCount: string;
  runningRunCount: string;
  failedRunCount: string;
  recentCost: string;
}

export interface DashboardAgentVolumeRow {
  agentId: string;
  agentName: string;
  count: string;
}

export interface DashboardCostMetricsRow {
  today: string;
  thisWeek: string;
  thisMonth: string;
  monthRunCount: string;
  totalTokensThisMonth: string;
  totalLlmCalls: string;
  pricedLlmCalls: string;
  estimatedLlmCalls: string;
}

export interface DashboardDailyCostRow {
  date: string;
  cost: string;
}

export interface DashboardAgentCostRow {
  agentId: string;
  agentName: string;
  cost: string;
  runCount: string;
  totalTokens: string;
}

export interface DashboardAgentDetailRow {
  id: string;
  name: string;
  description: string | null;
  defaultModel: string;
  lastRunAt: Date | string | null;
  runCount: string;
  completedRunCount: string;
  failedRunCount: string;
  totalCost: string;
  totalTokens: string;
}

export interface DashboardAgentRunRow {
  id: string;
  runId: string;
  status: string;
  startedAt: Date | string;
  cost: string;
  totalTokens: number;
}

export interface DashboardAgentIssueRow {
  id: string;
  title: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  lastSeenAt: Date | string;
}

/** Provides bounded aggregate queries for the dashboard first screen. */
export class DashboardRepository {
  constructor(
    private readonly sessions: DashboardSessionRepository = dashboardSessionRepository,
    private readonly agents: DashboardAgentRepository = dashboardAgentRepository,
    private readonly costs: DashboardCostRepository = dashboardCostRepository,
  ) {}

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

  /** 최근 24시간 이벤트 저장량과 저장 지연을 집계합니다. */
  async getIngestionSummary(workspaceId: string): Promise<IngestionSummaryRow> {
    const rows = (await AppDataSource.query(
      `
        SELECT
          MAX(event."createdAt") AS "lastStoredAt",
          COUNT(*) FILTER (
            WHERE event."createdAt" >= now() - interval '24 hours'
          )::text AS "storedEvents",
          COUNT(DISTINCT run.id) FILTER (
            WHERE event."createdAt" >= now() - interval '24 hours'
          )::text AS "activeRuns",
          COUNT(DISTINCT run."agentId") FILTER (
            WHERE event."createdAt" >= now() - interval '24 hours'
          )::text AS "activeAgents",
          percentile_cont(0.95) WITHIN GROUP (
            ORDER BY GREATEST(
              EXTRACT(EPOCH FROM (event."createdAt" - event."timestamp")) * 1000,
              0
            )
          ) FILTER (
            WHERE event."createdAt" >= now() - interval '24 hours'
          )::text AS "p95StorageDelayMs"
        FROM "event" event
        INNER JOIN "run" run ON run.id = event."runId"
        WHERE run."workspaceId" = $1
      `,
      [workspaceId],
    )) as IngestionSummaryRow[];

    return (
      rows[0] ?? {
        lastStoredAt: null,
        storedEvents: "0",
        activeRuns: "0",
        activeAgents: "0",
        p95StorageDelayMs: null,
      }
    );
  }

  /** 빈 시간도 포함한 최근 24개 시간대별 이벤트 저장량을 반환합니다. */
  getIngestionHourlyVolume(workspaceId: string): Promise<IngestionHourlyRow[]> {
    return AppDataSource.query(
      `
        SELECT
          bucket AS "timestamp",
          COUNT(collected.id)::text AS "count"
        FROM generate_series(
          date_trunc('hour', now()) - interval '23 hours',
          date_trunc('hour', now()),
          interval '1 hour'
        ) bucket
        LEFT JOIN (
          SELECT event.id, event."createdAt"
          FROM "event" event
          INNER JOIN "run" run ON run.id = event."runId"
          WHERE run."workspaceId" = $1
            AND event."createdAt" >= date_trunc('hour', now()) - interval '23 hours'
        ) collected
          ON collected."createdAt" >= bucket
          AND collected."createdAt" < bucket + interval '1 hour'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      [workspaceId],
    );
  }

  /** 최근 이벤트가 많은 Agent·환경 조합을 최대 8개까지 반환합니다. */
  getIngestionSources(workspaceId: string): Promise<IngestionSourceRow[]> {
    return AppDataSource.query(
      `
        SELECT
          agent.id AS "agentId",
          agent.name AS "agentName",
          COALESCE(NULLIF(event.payload->>'environment', ''), 'unknown') AS "environment",
          COUNT(*)::text AS "eventCount",
          MAX(event."createdAt") AS "lastStoredAt"
        FROM "event" event
        INNER JOIN "run" run ON run.id = event."runId"
        INNER JOIN "agent" agent ON agent.id = run."agentId"
        WHERE run."workspaceId" = $1
          AND event."createdAt" >= now() - interval '24 hours'
        GROUP BY agent.id, agent.name, "environment"
        ORDER BY MAX(event."createdAt") DESC, COUNT(*) DESC
        LIMIT 8
      `,
      [workspaceId],
    );
  }

  /** 최근 24시간에 저장된 상위 이벤트 타입을 최대 8개까지 반환합니다. */
  getIngestionEventTypes(
    workspaceId: string,
  ): Promise<IngestionEventTypeRow[]> {
    return AppDataSource.query(
      `
        SELECT event."eventType", COUNT(*)::text AS "count"
        FROM "event" event
        INNER JOIN "run" run ON run.id = event."runId"
        WHERE run."workspaceId" = $1
          AND event."createdAt" >= now() - interval '24 hours'
        GROUP BY event."eventType"
        ORDER BY COUNT(*) DESC, event."eventType" ASC
        LIMIT 8
      `,
      [workspaceId],
    );
  }

  /** 최근 24시간 Run을 Session 단위로 묶어 페이지 KPI를 계산합니다. */
  async getSessionMetrics(
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<DashboardSessionMetricsRow> {
    return this.sessions.getMetrics(workspaceId, scope);
  }

  /** 선택한 세션 화면에 표시할 최신 Session을 최대 8개 반환합니다. */
  getDashboardSessions(
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<DashboardSessionRow[]> {
    return this.sessions.getSessions(workspaceId, scope);
  }

  /** 선택한 상태의 최근 24시간 Session 시작량을 시간대별로 반환합니다. */
  getSessionHourlyVolume(
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<IngestionHourlyRow[]> {
    return this.sessions.getHourlyVolume(workspaceId, scope);
  }

  /** Agent 페이지 범위에 맞는 실제 Run 집계 KPI를 반환합니다. */
  async getAgentMetrics(
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentMetricsRow> {
    return this.agents.getMetrics(workspaceId, scope);
  }

  /** Agent 화면 범위에 맞는 Agent를 위험도와 최근 활동 순으로 반환합니다. */
  getDashboardAgents(
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentRow[]> {
    return this.agents.getAgents(workspaceId, scope);
  }

  /** Agent별 최근 24시간 Run 수를 최대 8개까지 반환합니다. */
  getAgentRunVolume(
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentVolumeRow[]> {
    return this.agents.getRunVolume(workspaceId, scope);
  }

  /** 오늘·이번 주·이번 달의 실제 Run 비용과 토큰을 집계합니다. */
  async getCostMetrics(workspaceId: string): Promise<DashboardCostMetricsRow> {
    return this.costs.getMetrics(workspaceId);
  }

  /** 최근 14일의 일별 실제 Run 비용을 빈 날짜까지 포함해 반환합니다. */
  getDailyCost(workspaceId: string): Promise<DashboardDailyCostRow[]> {
    return this.costs.getDailyCost(workspaceId);
  }

  /** 이번 달 비용이 높은 Agent를 최대 8개까지 반환합니다. */
  getTopAgentCosts(workspaceId: string): Promise<DashboardAgentCostRow[]> {
    return this.costs.getTopAgentCosts(workspaceId);
  }

  /** Session 상세 집계와 연결 이벤트를 실제 저장 데이터에서 조회합니다. */
  async getSessionDetail(workspaceId: string, sessionId: string) {
    return this.sessions.getDetail(workspaceId, sessionId);
  }

  /** Agent 상세 KPI, 최근 Run, 열린 이슈를 한 번에 조회합니다. */
  async getAgentDetail(workspaceId: string, agentId: string) {
    return this.agents.getDetail(workspaceId, agentId);
  }
}

export const dashboardRepository = new DashboardRepository();
