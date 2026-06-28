import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  EventEntity,
  SessionEntity,
  AgentEntity,
  OrganizationUserEntity,
} from '@repo/database';

@Injectable()
export class ObserveService {
  private readonly logger = new Logger(ObserveService.name);

  constructor(private readonly dataSource: DataSource) {}

  private async assertWorkspaceAccess(workspaceId: string, userId: string) {
    const membership = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .createQueryBuilder('membership')
      .innerJoin('membership.organization', 'organization')
      .innerJoin('organization.workspaces', 'workspace')
      .where('workspace.id = :workspaceId', { workspaceId })
      .andWhere('membership.userId = :userId', { userId })
      .getOne();

    if (!membership) {
      throw new ForbiddenException({
        message: 'You do not have access to this workspace.',
      });
    }
  }

  // 1. Overview Dashboard Metrics
  async getOverviewMetrics(workspaceId: string, userId: string) {
    await this.assertWorkspaceAccess(workspaceId, userId);

    const sessionRepo = this.dataSource.getRepository(SessionEntity);
    const eventRepo = this.dataSource.getRepository(EventEntity);

    // Get total count, cost, and tokens from session repository
    const sessions = await sessionRepo.find({
      where: { workspace: { id: workspaceId } },
    });

    const totalSessions = sessions.length;
    let totalCost = 0;
    let totalTokens = 0;
    for (const session of sessions) {
      totalCost += Number(session.totalCost);
      totalTokens += session.totalTokens;
    }

    // Average latency of events
    const avgLatencyResult = (await eventRepo
      .createQueryBuilder('event')
      .select('AVG(event.latency)', 'avg')
      .innerJoin('event.session', 'session')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .getRawOne()) as unknown as { avg: string | null } | null | undefined;
    const avgLatency = avgLatencyResult?.avg
      ? parseFloat(avgLatencyResult.avg)
      : 0;

    // Error rate
    const totalEventsCount = await eventRepo
      .createQueryBuilder('event')
      .innerJoin('event.session', 'session')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .getCount();

    const errorEventsCount = await eventRepo
      .createQueryBuilder('event')
      .innerJoin('event.session', 'session')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .andWhere('event.eventType = :errType', { errType: 'ERROR' })
      .getCount();

    const errorRate =
      totalEventsCount > 0 ? (errorEventsCount / totalEventsCount) * 100 : 0;

    return {
      totalSessions,
      totalCost,
      totalTokens,
      avgLatency,
      errorRate,
    };
  }

  // 2. Time-series Usage & Cost Analytics
  async getAnalytics(workspaceId: string, userId: string, days = 7) {
    await this.assertWorkspaceAccess(workspaceId, userId);

    const eventRepo = this.dataSource.getRepository(EventEntity);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);

    // Grouping by date (timestamp)
    const rawData = (await eventRepo
      .createQueryBuilder('event')
      .select("DATE_TRUNC('day', event.timestamp)", 'date')
      .addSelect('SUM(event.cost)', 'cost')
      .addSelect('COUNT(event.id)', 'calls')
      .innerJoin('event.session', 'session')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .andWhere('event.timestamp >= :limitDate', { limitDate })
      .groupBy("DATE_TRUNC('day', event.timestamp)")
      .orderBy("DATE_TRUNC('day', event.timestamp)", 'ASC')
      .getRawMany()) as unknown as Array<{
      date: string;
      cost: string | null;
      calls: string;
    }>;

    const analytics = rawData.map((row) => ({
      date: row.date,
      cost: parseFloat(row.cost ?? '0'),
      calls: parseInt(row.calls ?? '0'),
    }));

    return { analytics };
  }

  // 3. Agent Performance and List Stats
  async getAgentStats(workspaceId: string, userId: string): Promise<unknown[]> {
    await this.assertWorkspaceAccess(workspaceId, userId);

    const agentRepo = this.dataSource.getRepository(AgentEntity);
    const agents = await agentRepo.find({
      where: { workspace: { id: workspaceId } },
      relations: { sessions: true },
    });

    const results: unknown[] = [];
    for (const agent of agents) {
      let totalTokens = 0;
      let totalCost = 0;
      const runCount = agent.sessions?.length ?? 0;

      if (agent.sessions) {
        for (const s of agent.sessions) {
          totalTokens += s.totalTokens;
          totalCost += Number(s.totalCost);
        }
      }

      // Calculate avg latency for events under this agent's sessions
      const avgLatencyResult = (await this.dataSource
        .getRepository(EventEntity)
        .createQueryBuilder('event')
        .select('AVG(event.latency)', 'avg')
        .innerJoin('event.session', 'session')
        .where('session.agentId = :agentId', { agentId: agent.id })
        .getRawOne()) as unknown as { avg: string | null } | null | undefined;
      const avgLatency = avgLatencyResult?.avg
        ? parseFloat(avgLatencyResult.avg)
        : 0;

      results.push({
        id: agent.id,
        name: agent.name,
        runCount,
        totalTokens,
        totalCost,
        avgLatency,
      });
    }

    return results;
  }

  // 4. Session List
  async getSessions(workspaceId: string, userId: string, status?: string) {
    await this.assertWorkspaceAccess(workspaceId, userId);

    const sessionRepo = this.dataSource.getRepository(SessionEntity);
    const query = sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .orderBy('session.startedAt', 'DESC');

    if (status) {
      query.andWhere('session.status = :status', { status });
    }

    return await query.getMany();
  }

  // 5. Session details & timeline traceparent tree
  async getSessionTimeline(
    workspaceId: string,
    userId: string,
    sessionId: string,
  ) {
    await this.assertWorkspaceAccess(workspaceId, userId);

    const eventRepo = this.dataSource.getRepository(EventEntity);
    const events = await eventRepo.find({
      where: { session: { id: sessionId, workspace: { id: workspaceId } } },
      order: { timestamp: 'ASC' },
    });

    return events.map((event) => {
      const payloadObj = event.payload as Record<string, any> | undefined;
      return {
        id: event.id,
        eventType: event.eventType,
        label: event.label,
        timestamp: event.timestamp,
        latency: event.latency,
        cost: Number(event.cost ?? 0),
        spanId: payloadObj?.spanId as string | undefined,
        parentSpanId: payloadObj?.parentSpanId as string | undefined,
        input: payloadObj?.input as unknown,
        output: payloadObj?.output as unknown,
        error:
          (payloadObj?.error as string | undefined) || event.payload?.error,
      };
    });
  }

  // 6. Recent errors log
  async getRecentErrors(workspaceId: string, userId: string, limit = 50) {
    await this.assertWorkspaceAccess(workspaceId, userId);

    const eventRepo = this.dataSource.getRepository(EventEntity);
    const events = await eventRepo
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.session', 'session')
      .innerJoinAndSelect('session.agent', 'agent')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .andWhere('event.eventType = :errType', { errType: 'ERROR' })
      .orderBy('event.timestamp', 'DESC')
      .limit(limit)
      .getMany();

    return events;
  }
}
