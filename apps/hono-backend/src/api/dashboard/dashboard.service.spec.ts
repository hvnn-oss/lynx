import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import type { DashboardRepository } from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

function createService(input?: {
  runCount?: string;
  completedRunCount?: string;
  issueCount?: string;
}) {
  const repository = {
    getKpis: jest.fn().mockResolvedValue({
      runCount: input?.runCount ?? "10",
      completedRunCount: input?.completedRunCount ?? "9",
      issueCount: input?.issueCount ?? "3",
      criticalIssues: "1",
      warningIssues: "2",
      firewallBlocked: "4",
    }),
    getIssueTrend: jest
      .fn()
      .mockResolvedValue([{ date: "2026-07-25", count: "3" }]),
    getImportantIssues: jest.fn().mockResolvedValue([
      {
        id: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
        title: "Firewall blocked a risky action",
        severity: "CRITICAL",
      },
    ]),
    getIngestionSummary: jest.fn().mockResolvedValue({
      lastStoredAt: "2026-07-27T00:09:00.000Z",
      storedEvents: "120",
      activeRuns: "8",
      activeAgents: "3",
      p95StorageDelayMs: "450",
    }),
    getIngestionHourlyVolume: jest
      .fn()
      .mockResolvedValue([
        { timestamp: "2026-07-27T00:00:00.000Z", count: "12" },
      ]),
    getIngestionSources: jest.fn().mockResolvedValue([
      {
        agentId: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
        agentName: "support-agent",
        environment: "production",
        eventCount: "12",
        lastStoredAt: "2026-07-27T00:09:00.000Z",
      },
    ]),
    getIngestionEventTypes: jest
      .fn()
      .mockResolvedValue([{ eventType: "LLM_CALL", count: "7" }]),
    getSessionMetrics: jest.fn().mockResolvedValue({
      sessionCount: "2",
      completedCount: "1",
      failedCount: "1",
      runningCount: "0",
      averageDurationMs: "1500.4",
      averageCost: "0.25",
      blockedCount: "1",
    }),
    getSessionHourlyVolume: jest
      .fn()
      .mockResolvedValue([
        { timestamp: "2026-07-27T00:00:00.000Z", count: "2" },
      ]),
    getDashboardSessions: jest.fn().mockResolvedValue([
      {
        id: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
        sessionId: "session-1",
        name: "session-1",
        status: "FAILED",
        startedAt: "2026-07-27T00:00:00.000Z",
        endedAt: "2026-07-27T00:00:01.500Z",
        durationMs: "1500",
        cost: "0.25",
        runCount: "2",
        agentId: "120e4bb6-7d97-41f1-a0d5-304a379b332a",
        agentName: "support-agent",
      },
    ]),
    getAgentMetrics: jest.fn().mockResolvedValue({
      agentCount: "2",
      activeCount: "1",
      inactiveCount: "1",
      runningRunCount: "1",
      failedRunCount: "2",
    }),
    getDashboardAgents: jest.fn().mockResolvedValue([
      {
        id: "120e4bb6-7d97-41f1-a0d5-304a379b332a",
        name: "support-agent",
        defaultModel: "gpt-5",
        status: "ACTIVE",
        lastRunAt: "2026-07-27T00:09:00.000Z",
        recentRunCount: "3",
        runningRunCount: "1",
        failedRunCount: "2",
        recentCost: "0.4",
      },
    ]),
    getAgentRunVolume: jest.fn().mockResolvedValue([
      {
        agentId: "120e4bb6-7d97-41f1-a0d5-304a379b332a",
        agentName: "support-agent",
        count: "3",
      },
    ]),
    getCostMetrics: jest.fn().mockResolvedValue({
      today: "1.2",
      thisWeek: "3.4",
      thisMonth: "5",
      monthRunCount: "4",
      totalTokensThisMonth: "1200",
      totalLlmCalls: "10",
      pricedLlmCalls: "8",
      estimatedLlmCalls: "7",
    }),
    getDailyCost: jest
      .fn()
      .mockResolvedValue([{ date: "2026-07-27", cost: "1.2" }]),
    getTopAgentCosts: jest.fn().mockResolvedValue([
      {
        agentId: "120e4bb6-7d97-41f1-a0d5-304a379b332a",
        agentName: "support-agent",
        cost: "5",
        runCount: "4",
        totalTokens: "1200",
      },
    ]),
    getSessionDetail: jest.fn().mockResolvedValue({
      session: {
        id: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
        sessionId: "session-1",
        name: "session-1",
        status: "COMPLETED",
        startedAt: "2026-07-27T00:00:00.000Z",
        endedAt: "2026-07-27T00:00:01.500Z",
        durationMs: "1500",
        cost: "0.25",
        runCount: "1",
        totalTokens: "120",
        agentId: "120e4bb6-7d97-41f1-a0d5-304a379b332a",
        agentName: "support-agent",
      },
      events: [
        {
          id: "90b518a6-9055-4493-b39e-fd6dfd08520a",
          clientEventId: "event-1",
          eventType: "LLM_CALL",
          label: "model call",
          timestamp: "2026-07-27T00:00:00.500Z",
          latency: 500,
          cost: "0.25",
          payload: {},
        },
      ],
      issueCount: 0,
    }),
    getAgentDetail: jest.fn().mockResolvedValue({
      agent: {
        id: "120e4bb6-7d97-41f1-a0d5-304a379b332a",
        name: "support-agent",
        description: null,
        defaultModel: "gpt-5",
        lastRunAt: "2026-07-27T00:09:00.000Z",
        runCount: "4",
        completedRunCount: "3",
        failedRunCount: "1",
        totalCost: "0.5",
        totalTokens: "1200",
      },
      recentRuns: [],
      recentIssues: [],
    }),
  } as unknown as DashboardRepository;
  const accessControl = {
    assertWorkspaceCapability: jest.fn().mockResolvedValue({}),
  } as unknown as AccessControlService;

  return {
    service: new DashboardService(repository, accessControl),
    repository,
    accessControl,
  };
}

describe("DashboardService", () => {
  it("returns a bounded overview and computes the completion rate", async () => {
    const { service, accessControl } = createService();

    const result = await service.getOverview("user-1", "workspace-1");

    expect(result).toEqual({
      hasData: true,
      kpis: {
        criticalIssues: 1,
        warningIssues: 2,
        firewallBlocked: 4,
        normalThroughputRate: 90,
      },
      issueTrend: [{ date: "2026-07-25", count: 3 }],
      importantIssues: [
        {
          id: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
          title: "Firewall blocked a risky action",
          severity: "CRITICAL",
        },
      ],
    });
    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "workspace-1",
      }),
    );
  });

  it("marks the response empty when the workspace has no runs or issues", async () => {
    const { service } = createService({
      runCount: "0",
      completedRunCount: "0",
      issueCount: "0",
    });

    const result = await service.getOverview("user-1", "workspace-1");

    expect(result.hasData).toBe(false);
    expect(result.kpis.normalThroughputRate).toBe(0);
  });

  it("returns ingestion status from stored event aggregates", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-27T00:10:00.000Z"));
    const { service, accessControl } = createService();

    const result = await service.getIngestionStatus("user-1", "workspace-1");

    expect(result).toEqual({
      status: "HEALTHY",
      window: {
        hours: 24,
        from: "2026-07-26T00:10:00.000Z",
        to: "2026-07-27T00:10:00.000Z",
      },
      lastStoredAt: "2026-07-27T00:09:00.000Z",
      metrics: {
        storedEvents: 120,
        activeRuns: 8,
        activeAgents: 3,
        p95StorageDelayMs: 450,
      },
      hourlyVolume: [{ timestamp: "2026-07-27T00:00:00.000Z", count: 12 }],
      sources: [
        {
          agentId: "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
          agentName: "support-agent",
          environment: "production",
          eventCount: 12,
          lastStoredAt: "2026-07-27T00:09:00.000Z",
        },
      ],
      eventTypes: [{ eventType: "LLM_CALL", count: 7 }],
    });
    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "workspace-1",
      }),
    );
    jest.useRealTimers();
  });

  it("returns a page-ready session response", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-27T00:10:00.000Z"));
    const { service, repository } = createService();

    const result = await service.getSessions("user-1", "workspace-1", "FAILED");

    expect(result.scope).toBe("FAILED");
    expect(result.metrics).toEqual({
      sessionCount: 2,
      completedCount: 1,
      failedCount: 1,
      runningCount: 0,
      averageDurationMs: 1500,
      averageCost: 0.25,
      blockedCount: 1,
    });
    expect(result.sessions[0]).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        status: "FAILED",
        runCount: 2,
      }),
    );
    expect(repository.getSessionMetrics).toHaveBeenCalledWith(
      "workspace-1",
      "FAILED",
    );
    jest.useRealTimers();
  });

  it("returns a page-ready agent response", async () => {
    const { service, repository } = createService();

    const result = await service.getAgents("user-1", "workspace-1", "ACTIVE");

    expect(result.scope).toBe("ACTIVE");
    expect(result.metrics.failedRunCount).toBe(2);
    expect(result.agents[0]).toEqual(
      expect.objectContaining({
        name: "support-agent",
        status: "ACTIVE",
        recentRunCount: 3,
      }),
    );
    expect(repository.getDashboardAgents).toHaveBeenCalledWith(
      "workspace-1",
      "ACTIVE",
    );
  });

  it("returns actual run cost aggregates", async () => {
    const { service } = createService();

    const result = await service.getCost("user-1", "workspace-1");

    expect(result.metrics).toEqual({
      today: 1.2,
      thisWeek: 3.4,
      thisMonth: 5,
      averagePerRunThisMonth: 1.25,
      totalTokensThisMonth: 1200,
    });
    expect(result.pricingCoverage).toEqual({
      catalogVersion: "standard-text-2026-07-28",
      totalLlmCalls: 10,
      pricedLlmCalls: 8,
      unpricedLlmCalls: 2,
      estimatedLlmCalls: 7,
      percentage: 80,
    });
    expect(result.topAgents[0]).toEqual(
      expect.objectContaining({
        agentName: "support-agent",
        cost: 5,
        runCount: 4,
      }),
    );
  });

  it("returns real session and agent detail data", async () => {
    const { service } = createService();

    const session = await service.getSessionDetail(
      "user-1",
      "workspace-1",
      "7ac20620-a9e6-40a2-9e32-2af7fe32e553",
    );
    const agent = await service.getAgentDetail(
      "user-1",
      "workspace-1",
      "120e4bb6-7d97-41f1-a0d5-304a379b332a",
    );

    expect(session.events).toHaveLength(1);
    expect(session.totalTokens).toBe(120);
    expect(agent.metrics).toEqual(
      expect.objectContaining({
        runCount: 4,
        completedRunCount: 3,
        failedRunCount: 1,
      }),
    );
  });
});
