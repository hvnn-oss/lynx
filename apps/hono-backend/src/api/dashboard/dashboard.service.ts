import type {
  DashboardAgentScope,
  DashboardAgentDetailResponseDto,
  DashboardAgentsResponseDto,
  DashboardCostResponseDto,
  DashboardIngestionStatusResponseDto,
  DashboardOverviewResponseDto,
  DashboardSessionScope,
  DashboardSessionDetailResponseDto,
  DashboardSessionsResponseDto,
  IngestionHealthStatus,
} from "@repo/dto";
import { MODEL_PRICING_VERSION } from "../../common/services/llm-cost.service.js";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import {
  DashboardRepository,
  dashboardRepository,
} from "./dashboard.repository.js";

const INGESTION_WINDOW_HOURS = 24;
const INACTIVE_AFTER_MS = 15 * 60 * 1_000;
const DELAYED_AFTER_MS = 5_000;

/** Builds the bounded operational summary used by the dashboard first screen. */
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository = dashboardRepository,
    private readonly accessControl: AccessControlService = accessControlService,
  ) {}

  async getOverview(
    userId: string,
    workspaceId: string,
  ): Promise<DashboardOverviewResponseDto> {
    await this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });

    const [kpis, issueTrend, importantIssues] = await Promise.all([
      this.repository.getKpis(workspaceId),
      this.repository.getIssueTrend(workspaceId),
      this.repository.getImportantIssues(workspaceId),
    ]);
    const runCount = Number(kpis.runCount);
    const issueCount = Number(kpis.issueCount);

    return {
      hasData: runCount > 0 || issueCount > 0,
      kpis: {
        criticalIssues: Number(kpis.criticalIssues),
        warningIssues: Number(kpis.warningIssues),
        firewallBlocked: Number(kpis.firewallBlocked),
        normalThroughputRate:
          runCount === 0
            ? 0
            : Math.round((Number(kpis.completedRunCount) / runCount) * 1_000) /
              10,
      },
      issueTrend: issueTrend.map((bucket) => ({
        date: bucket.date,
        count: Number(bucket.count),
      })),
      importantIssues,
    };
  }

  /** 실제 저장된 Event를 기준으로 워크스페이스 수집 상태를 반환합니다. */
  async getIngestionStatus(
    userId: string,
    workspaceId: string,
  ): Promise<DashboardIngestionStatusResponseDto> {
    await this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });

    const [summary, hourlyVolume, sources, eventTypes] = await Promise.all([
      this.repository.getIngestionSummary(workspaceId),
      this.repository.getIngestionHourlyVolume(workspaceId),
      this.repository.getIngestionSources(workspaceId),
      this.repository.getIngestionEventTypes(workspaceId),
    ]);
    const now = new Date();
    const lastStoredAt = summary.lastStoredAt
      ? new Date(summary.lastStoredAt)
      : null;
    const p95StorageDelayMs =
      summary.p95StorageDelayMs === null
        ? null
        : Math.max(0, Math.round(Number(summary.p95StorageDelayMs)));

    return {
      status: this.selectIngestionStatus(lastStoredAt, p95StorageDelayMs, now),
      window: {
        hours: INGESTION_WINDOW_HOURS,
        from: new Date(
          now.getTime() - INGESTION_WINDOW_HOURS * 60 * 60 * 1_000,
        ).toISOString(),
        to: now.toISOString(),
      },
      lastStoredAt: lastStoredAt?.toISOString() ?? null,
      metrics: {
        storedEvents: Number(summary.storedEvents),
        activeRuns: Number(summary.activeRuns),
        activeAgents: Number(summary.activeAgents),
        p95StorageDelayMs,
      },
      hourlyVolume: hourlyVolume.map((bucket) => ({
        timestamp: new Date(bucket.timestamp).toISOString(),
        count: Number(bucket.count),
      })),
      sources: sources.map((source) => ({
        agentId: source.agentId,
        agentName: source.agentName,
        environment: source.environment,
        eventCount: Number(source.eventCount),
        lastStoredAt: new Date(source.lastStoredAt).toISOString(),
      })),
      eventTypes: eventTypes.map((eventType) => ({
        eventType: eventType.eventType,
        count: Number(eventType.count),
      })),
    };
  }

  /** 최근 저장 시각과 p95 저장 지연으로 표시용 수집 상태를 결정합니다. */
  private selectIngestionStatus(
    lastStoredAt: Date | null,
    p95StorageDelayMs: number | null,
    now: Date,
  ): IngestionHealthStatus {
    if (!lastStoredAt) return "NO_DATA";
    if (now.getTime() - lastStoredAt.getTime() > INACTIVE_AFTER_MS)
      return "INACTIVE";
    if (p95StorageDelayMs !== null && p95StorageDelayMs > DELAYED_AFTER_MS)
      return "DELAYED";
    return "HEALTHY";
  }

  /** 선택한 세션 화면에 필요한 KPI, 추이, 최근 목록을 한 번에 반환합니다. */
  async getSessions(
    userId: string,
    workspaceId: string,
    scope: DashboardSessionScope,
  ): Promise<DashboardSessionsResponseDto> {
    await this.assertWorkspaceRead(userId, workspaceId);
    const [metrics, hourlyVolume, sessions] = await Promise.all([
      this.repository.getSessionMetrics(workspaceId, scope),
      this.repository.getSessionHourlyVolume(workspaceId, scope),
      this.repository.getDashboardSessions(workspaceId, scope),
    ]);
    const now = new Date();

    return {
      scope,
      window: {
        hours: INGESTION_WINDOW_HOURS,
        from: new Date(
          now.getTime() - INGESTION_WINDOW_HOURS * 60 * 60 * 1_000,
        ).toISOString(),
        to: now.toISOString(),
      },
      metrics: {
        sessionCount: Number(metrics.sessionCount),
        completedCount: Number(metrics.completedCount),
        failedCount: Number(metrics.failedCount),
        runningCount: Number(metrics.runningCount),
        averageDurationMs: this.nullableRoundedNumber(
          metrics.averageDurationMs,
        ),
        averageElapsedDurationMs: this.nullableRoundedNumber(
          metrics.averageElapsedDurationMs,
        ),
        averageCost: this.nonnegativeNumber(metrics.averageCost),
        blockedCount: Number(metrics.blockedCount),
      },
      hourlyVolume: hourlyVolume.map((bucket) => ({
        timestamp: new Date(bucket.timestamp).toISOString(),
        count: Number(bucket.count),
      })),
      sessions: sessions.map((session) => ({
        id: session.id,
        sessionId: session.sessionId,
        name: session.name,
        status: session.status,
        startedAt: new Date(session.startedAt).toISOString(),
        lastActivityAt: new Date(session.lastActivityAt).toISOString(),
        endedAt: session.endedAt
          ? new Date(session.endedAt).toISOString()
          : null,
        durationMs: this.nullableRoundedNumber(session.durationMs),
        elapsedDurationMs: this.nullableRoundedNumber(
          session.elapsedDurationMs,
        ),
        cost: this.nonnegativeNumber(session.cost),
        runCount: Number(session.runCount),
        agent: {
          id: session.agentId,
          name: session.agentName,
        },
      })),
    };
  }

  /** 선택한 Agent 화면에 필요한 KPI와 Agent별 Run 집계를 반환합니다. */
  async getAgents(
    userId: string,
    workspaceId: string,
    scope: DashboardAgentScope,
  ): Promise<DashboardAgentsResponseDto> {
    await this.assertWorkspaceRead(userId, workspaceId);
    const [metrics, agents, runVolume] = await Promise.all([
      this.repository.getAgentMetrics(workspaceId, scope),
      this.repository.getDashboardAgents(workspaceId, scope),
      this.repository.getAgentRunVolume(workspaceId, scope),
    ]);

    return {
      scope,
      activeWithinHours: INGESTION_WINDOW_HOURS,
      metrics: {
        agentCount: Number(metrics.agentCount),
        activeCount: Number(metrics.activeCount),
        inactiveCount: Number(metrics.inactiveCount),
        runningRunCount: Number(metrics.runningRunCount),
        failedRunCount: Number(metrics.failedRunCount),
      },
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        defaultModel: agent.defaultModel,
        status: agent.status,
        lastRunAt: agent.lastRunAt
          ? new Date(agent.lastRunAt).toISOString()
          : null,
        recentRunCount: Number(agent.recentRunCount),
        runningRunCount: Number(agent.runningRunCount),
        failedRunCount: Number(agent.failedRunCount),
        recentCost: this.nonnegativeNumber(agent.recentCost),
      })),
      runVolume: runVolume.map((agent) => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        count: Number(agent.count),
      })),
    };
  }

  /** 실제 Run 비용으로 비용 분석 화면 전체 응답을 구성합니다. */
  async getCost(
    userId: string,
    workspaceId: string,
  ): Promise<DashboardCostResponseDto> {
    await this.assertWorkspaceRead(userId, workspaceId);
    const [metrics, dailyCost, topAgents] = await Promise.all([
      this.repository.getCostMetrics(workspaceId),
      this.repository.getDailyCost(workspaceId),
      this.repository.getTopAgentCosts(workspaceId),
    ]);
    const monthCost = this.nonnegativeNumber(metrics.thisMonth);
    const monthRunCount = Number(metrics.monthRunCount);
    const totalLlmCalls = this.nonnegativeInteger(metrics.totalLlmCalls);
    const pricedLlmCalls = Math.min(
      totalLlmCalls,
      this.nonnegativeInteger(metrics.pricedLlmCalls),
    );

    return {
      currency: "USD",
      metrics: {
        today: this.nonnegativeNumber(metrics.today),
        thisWeek: this.nonnegativeNumber(metrics.thisWeek),
        thisMonth: monthCost,
        averagePerRunThisMonth:
          monthRunCount === 0
            ? 0
            : Math.round((monthCost / monthRunCount) * 1_000_000) / 1_000_000,
        totalTokensThisMonth: Number(metrics.totalTokensThisMonth),
      },
      pricingCoverage: {
        catalogVersion: MODEL_PRICING_VERSION,
        totalLlmCalls,
        pricedLlmCalls,
        unpricedLlmCalls: totalLlmCalls - pricedLlmCalls,
        estimatedLlmCalls: Math.min(
          pricedLlmCalls,
          this.nonnegativeInteger(metrics.estimatedLlmCalls),
        ),
        percentage:
          totalLlmCalls === 0
            ? 0
            : Math.round((pricedLlmCalls / totalLlmCalls) * 1_000) / 10,
      },
      dailyCost: dailyCost.map((bucket) => ({
        date: bucket.date,
        cost: this.nonnegativeNumber(bucket.cost),
      })),
      topAgents: topAgents.map((agent) => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        cost: this.nonnegativeNumber(agent.cost),
        runCount: Number(agent.runCount),
        totalTokens: Number(agent.totalTokens),
      })),
    };
  }

  /** Session 상세 요약과 최대 100개 이벤트 타임라인을 반환합니다. */
  async getSessionDetail(
    userId: string,
    workspaceId: string,
    sessionId: string,
  ): Promise<DashboardSessionDetailResponseDto> {
    await this.assertWorkspaceRead(userId, workspaceId);
    const result = await this.repository.getSessionDetail(
      workspaceId,
      sessionId,
    );
    if (!result.session) throw new NotFoundErrorException("SESSION_NOT_FOUND");
    const session = result.session;
    const events = result.events.slice(0, 100);

    return {
      id: session.id,
      sessionId: session.sessionId,
      name: session.name,
      status: session.status,
      startedAt: new Date(session.startedAt).toISOString(),
      lastActivityAt: new Date(session.lastActivityAt).toISOString(),
      endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      durationMs: this.nullableRoundedNumber(session.durationMs),
      elapsedDurationMs: this.nullableRoundedNumber(session.elapsedDurationMs),
      cost: this.nonnegativeNumber(session.cost),
      totalTokens: Number(session.totalTokens ?? 0),
      runCount: Number(session.runCount),
      issueCount: result.issueCount,
      agent: { id: session.agentId, name: session.agentName },
      events: events.map((event) => ({
        id: event.id,
        eventId: event.clientEventId,
        eventType: event.eventType,
        label: event.label,
        timestamp: new Date(event.timestamp).toISOString(),
        latency: event.latency,
        cost: event.cost === null ? null : this.nonnegativeNumber(event.cost),
        payload: event.payload ?? {},
      })),
      hasMoreEvents: result.events.length > events.length,
    };
  }

  /** Agent 상세 KPI와 최근 Run·열린 이슈를 반환합니다. */
  async getAgentDetail(
    userId: string,
    workspaceId: string,
    agentId: string,
  ): Promise<DashboardAgentDetailResponseDto> {
    await this.assertWorkspaceRead(userId, workspaceId);
    const result = await this.repository.getAgentDetail(workspaceId, agentId);
    if (!result.agent) throw new NotFoundErrorException("AGENT_NOT_FOUND");
    const agent = result.agent;

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      defaultModel: agent.defaultModel,
      lastRunAt: agent.lastRunAt
        ? new Date(agent.lastRunAt).toISOString()
        : null,
      metrics: {
        runCount: Number(agent.runCount),
        completedRunCount: Number(agent.completedRunCount),
        failedRunCount: Number(agent.failedRunCount),
        totalCost: this.nonnegativeNumber(agent.totalCost),
        totalTokens: Number(agent.totalTokens),
      },
      recentRuns: result.recentRuns.map((run) => ({
        id: run.id,
        runId: run.runId,
        status: run.status,
        startedAt: new Date(run.startedAt).toISOString(),
        cost: this.nonnegativeNumber(run.cost),
        totalTokens: run.totalTokens,
      })),
      recentIssues: result.recentIssues.map((issue) => ({
        id: issue.id,
        title: issue.title,
        severity: issue.severity,
        lastSeenAt: new Date(issue.lastSeenAt).toISOString(),
      })),
    };
  }

  private async assertWorkspaceRead(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
  }

  private nullableRoundedNumber(value: string | null): number | null {
    if (value === null) return null;
    return Math.max(0, Math.round(Number(value)));
  }

  private nonnegativeNumber(value: string | null): number {
    const number = Number(value ?? 0);
    return Math.max(
      0,
      Math.round(number * 1_000_000_000_000) / 1_000_000_000_000,
    );
  }

  private nonnegativeInteger(value: string | null): number {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
  }
}

export const dashboardService = new DashboardService();
