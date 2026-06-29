import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AgentEntity, EventEntity, SessionEntity } from '@repo/database';
import {
  AgentBehaviorEventDto,
  AgentDetailQueryDto,
  AgentDetailResponseDto,
  AgentIssueBadgeDto,
  AgentListItemDto,
  AgentListQueryDto,
  AgentListResponseDto,
  AgentMetricPointDto,
  AgentOverviewResponseDto,
  AgentPageInfoDto,
  AgentStatus,
  AgentToolUsageItemDto,
  AgentSaasAccessItemDto,
} from '@repo/dto';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import {
  createPreview,
  deriveIssues,
  getPayload,
  getPayloadBoolean,
  getPayloadNumber,
  getPayloadString,
  toDebugString,
} from '../debug/debug.utils';

interface CursorValue {
  name: string;
  id: string;
}

interface AgentRuntimeStats {
  sessions: SessionEntity[];
  events: EventEntity[];
}

const DEFAULT_AGENT_LIMIT = 25;
const MAX_AGENT_LIMIT = 100;
const AGENT_LOOKBACK_LIMIT = 1000;
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const INACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AgentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async listAgents(
    query: AgentListQueryDto,
    userId: string,
  ): Promise<AgentListResponseDto> {
    await this.workspaceAccess.assertAccess(userId, query.workspaceId);

    const limit = this.normalizeLimit(query.limit);
    const agents = await this.findAgents(query);
    const stats = await this.getRuntimeStats(query.workspaceId, query);
    const mapped = agents.map((agent) =>
      this.toListItem(
        agent,
        stats.get(agent.id) ?? { sessions: [], events: [] },
      ),
    );
    const filtered = this.applyFilters(
      this.filterByKind(mapped, query.kind),
      query,
    );
    const sorted = this.sortAgents(filtered, query.kind);
    const cursor = this.decodeCursor(query.cursor);
    const afterCursor = cursor
      ? sorted.filter(
          (agent) =>
            agent.name > cursor.name ||
            (agent.name === cursor.name && agent.agentId > cursor.id),
        )
      : sorted;
    const visible = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;

    return {
      overview: this.createOverview(filtered),
      agents: visible,
      page: this.createPageInfo(visible, hasMore, filtered.length),
    };
  }

  async getDetail(
    agentId: string,
    query: AgentDetailQueryDto,
    userId: string,
  ): Promise<AgentDetailResponseDto> {
    await this.workspaceAccess.assertAccess(userId, query.workspaceId);
    const agent = await this.dataSource
      .getRepository<AgentEntity>(AgentEntity)
      .createQueryBuilder('agent')
      .where('agent.id = :agentId', { agentId })
      .andWhere('agent.workspaceId = :workspaceId', {
        workspaceId: query.workspaceId,
      })
      .getOne();

    if (!agent) {
      throw new NotFoundException({ message: 'Agent not found.' });
    }

    const stats = await this.getAgentRuntimeStats(query.workspaceId, agentId);
    const item = this.toListItem(agent, stats);
    const recentSessions = stats.sessions.slice(0, 10).map((session) => {
      const issues = deriveIssues(session.events ?? []);
      return {
        sessionId: session.id,
        runId: session.name,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        durationMs: this.getDurationMs(session),
        totalCost: Number(session.totalCost ?? 0),
        totalTokens: session.totalTokens ?? 0,
        primaryIssue: issues[0]?.type,
      };
    });

    return {
      ...item,
      recentSessions,
      toolUsage: this.createToolUsage(stats.events),
      saasAccess: this.createSaasAccess(stats.events),
      behaviorHistory: this.createBehaviorHistory(agent, stats.events),
      performance: {
        latencyTrend: item.trend.map((point) => ({
          timestamp: point.timestamp,
          value: point.latencyMs ?? 0,
          latencyMs: point.latencyMs,
        })),
        successTrend: item.trend.map((point) => ({
          timestamp: point.timestamp,
          value:
            (point.successCount ?? 0) + (point.failedCount ?? 0) === 0
              ? 0
              : (point.successCount ?? 0) /
                ((point.successCount ?? 0) + (point.failedCount ?? 0)),
          successCount: point.successCount,
          failedCount: point.failedCount,
        })),
        costTrend: item.trend.map((point) => ({
          timestamp: point.timestamp,
          value: point.cost ?? 0,
          cost: point.cost,
        })),
        tokenTrend: item.trend.map((point) => ({
          timestamp: point.timestamp,
          value: point.tokens ?? 0,
          tokens: point.tokens,
        })),
      },
      recommendations: this.createRecommendations(item),
    };
  }

  private async findAgents(query: AgentListQueryDto): Promise<AgentEntity[]> {
    const qb = this.dataSource
      .getRepository<AgentEntity>(AgentEntity)
      .createQueryBuilder('agent')
      .where('agent.workspaceId = :workspaceId', {
        workspaceId: query.workspaceId,
      })
      .orderBy('agent.name', 'ASC')
      .addOrderBy('agent.id', 'ASC')
      .take(MAX_AGENT_LIMIT);

    if (query.agentId) {
      qb.andWhere('agent.id = :agentId', { agentId: query.agentId });
    }
    if (query.agent) {
      qb.andWhere('agent.name ILIKE :agent', { agent: `%${query.agent}%` });
    }
    if (query.search) {
      qb.andWhere(
        '(agent.name ILIKE :search OR agent.description ILIKE :search OR agent.defaultModel ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return qb.getMany();
  }

  private async getRuntimeStats(
    workspaceId: string,
    query: AgentListQueryDto,
  ): Promise<Map<string, AgentRuntimeStats>> {
    const qb = this.dataSource
      .getRepository<SessionEntity>(SessionEntity)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .leftJoinAndSelect('session.events', 'event')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .orderBy('session.startedAt', 'DESC')
      .take(AGENT_LOOKBACK_LIMIT);

    if (query.from) {
      qb.andWhere('session.startedAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('session.startedAt <= :to', { to: new Date(query.to) });
    }

    const sessions: SessionEntity[] = await qb.getMany();
    const stats = new Map<string, AgentRuntimeStats>();
    for (const session of sessions) {
      const agentId = session.agent?.id;
      if (!agentId) continue;
      const current = stats.get(agentId) ?? { sessions: [], events: [] };
      current.sessions.push(session);
      current.events.push(...(session.events ?? []));
      stats.set(agentId, current);
    }
    return stats;
  }

  private async getAgentRuntimeStats(
    workspaceId: string,
    agentId: string,
  ): Promise<AgentRuntimeStats> {
    const sessions: SessionEntity[] = await this.dataSource
      .getRepository<SessionEntity>(SessionEntity)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .leftJoinAndSelect('session.events', 'event')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .andWhere('session.agentId = :agentId', { agentId })
      .orderBy('session.startedAt', 'DESC')
      .take(AGENT_LOOKBACK_LIMIT)
      .getMany();

    return {
      sessions,
      events: sessions.flatMap((session) => session.events ?? []),
    };
  }

  private toListItem(
    agent: AgentEntity,
    stats: AgentRuntimeStats,
  ): AgentListItemDto {
    const sessions = stats.sessions;
    const events = this.sortEvents(stats.events);
    const completed = sessions.filter(
      (session) => session.status === 'COMPLETED',
    );
    const failed = sessions.filter(
      (session) =>
        session.status === 'FAILED' ||
        session.status === 'CANCELLED' ||
        deriveIssues(session.events ?? []).some(
          (issue) => issue.severity === 'CRITICAL',
        ),
    );
    const now = Date.now();
    const sessions24h = sessions.filter(
      (session) => now - session.startedAt.getTime() <= ACTIVE_WINDOW_MS,
    );
    const lastRunAt = sessions[0]?.startedAt;
    const latencies = sessions
      .map((session) => this.getDurationMs(session))
      .filter((value): value is number => typeof value === 'number');
    const issueBadges = this.createIssueBadges(events, sessions);
    const totalCost = sessions.reduce(
      (sum, session) => sum + Number(session.totalCost ?? 0),
      0,
    );
    const totalTokens = sessions.reduce(
      (sum, session) => sum + (session.totalTokens ?? 0),
      0,
    );
    const successRate =
      sessions.length === 0 ? null : completed.length / sessions.length;
    const failureRate =
      sessions.length === 0 ? null : failed.length / sessions.length;

    return {
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      role: this.firstPayloadString(events, 'role'),
      owner: this.firstPayloadString(events, 'owner'),
      team: this.firstPayloadString(events, 'team'),
      group: this.firstPayloadString(events, 'group') ?? 'default',
      status: this.deriveStatus(lastRunAt, successRate, issueBadges),
      environment:
        this.firstPayloadString(events, 'environment') ?? 'production',
      version: this.firstPayloadString(events, 'agentVersion'),
      defaultModel: agent.defaultModel,
      lastActiveAt: lastRunAt?.toISOString(),
      lastRunAt: lastRunAt?.toISOString(),
      sessionCount24h: sessions24h.length,
      totalSessions: sessions.length,
      successRate,
      failureRate,
      avgLatencyMs: this.average(latencies),
      p95LatencyMs: this.percentile(latencies, 95),
      totalCost,
      totalTokens,
      avgCostPerRun: sessions.length === 0 ? null : totalCost / sessions.length,
      tokensPerSuccessfulRun:
        completed.length === 0 ? null : totalTokens / completed.length,
      llmCallCount: events.filter((event) => event.eventType.includes('LLM'))
        .length,
      toolCallCount: events.filter((event) => event.eventType.includes('TOOL'))
        .length,
      guardrailCount: events.filter(
        (event) =>
          event.eventType.includes('GUARDRAIL') ||
          event.eventType === 'POLICY_EVALUATION',
      ).length,
      errorCount: events.filter(
        (event) => event.eventType === 'ERROR' || getPayload(event).error,
      ).length,
      retryCount: events.filter(
        (event) =>
          event.eventType.includes('RETRY') ||
          (getPayloadNumber(getPayload(event), 'retryCount') ?? 0) > 0,
      ).length,
      connectedToolCount: this.uniqueTools(events).length,
      models: this.uniquePayloadStrings(events, 'model'),
      tools: this.uniqueTools(events),
      saasApps: this.uniqueSaasApps(events),
      issueBadges,
      primaryIssue: issueBadges[0]?.type,
      recommendation: this.createPrimaryRecommendation(issueBadges),
      relatedLinks: [
        {
          label: '세션 보기',
          href: `/dashboard/session/overview?agentId=${agent.id}`,
          kind: 'sessions',
        },
        {
          label: '디버깅',
          href: `/debug/logs?agentId=${agent.id}`,
          kind: 'debug',
        },
        {
          label: '도구 분석',
          href: `/agents/tools?agentId=${agent.id}`,
          kind: 'tools',
        },
      ],
      trend: this.createTrend(sessions),
    };
  }

  private filterByKind(
    agents: AgentListItemDto[],
    kind: AgentListQueryDto['kind'],
  ) {
    if (!kind || kind === 'overview') return agents;
    if (kind === 'active') {
      return agents.filter((agent) => agent.status !== 'INACTIVE');
    }
    if (kind === 'inactive') {
      return agents.filter((agent) => agent.status === 'INACTIVE');
    }
    if (kind === 'latency') {
      return agents.filter((agent) => (agent.avgLatencyMs ?? 0) > 0);
    }
    if (kind === 'tokens') {
      return agents.filter((agent) => agent.totalTokens > 0);
    }
    if (kind === 'success-rate') {
      return agents.filter((agent) => agent.successRate !== null);
    }
    if (kind === 'cost') {
      return agents.filter((agent) => agent.totalCost > 0);
    }
    return agents;
  }

  private applyFilters(agents: AgentListItemDto[], query: AgentListQueryDto) {
    const search = query.search?.trim().toLowerCase();
    return agents.filter((agent) => {
      if (query.status && agent.status !== query.status) return false;
      if (query.agentId && agent.agentId !== query.agentId) return false;
      if (
        query.agent &&
        !agent.name.toLowerCase().includes(query.agent.toLowerCase())
      ) {
        return false;
      }
      if (
        query.environment &&
        !agent.environment
          ?.toLowerCase()
          .includes(query.environment.toLowerCase())
      ) {
        return false;
      }
      if (query.group && agent.group !== query.group) return false;
      if (
        query.model &&
        !agent.models.some((model) =>
          model.toLowerCase().includes(query.model!.toLowerCase()),
        )
      ) {
        return false;
      }
      if (
        query.tool &&
        !agent.tools.some((tool) =>
          tool.toLowerCase().includes(query.tool!.toLowerCase()),
        )
      ) {
        return false;
      }
      if (search && !this.matchesSearch(agent, search)) return false;
      return true;
    });
  }

  private sortAgents(
    agents: AgentListItemDto[],
    kind: AgentListQueryDto['kind'],
  ) {
    const sorted = [...agents];
    if (kind === 'latency') {
      return sorted.sort(
        (a, b) => (b.p95LatencyMs ?? 0) - (a.p95LatencyMs ?? 0),
      );
    }
    if (kind === 'tokens') {
      return sorted.sort((a, b) => b.totalTokens - a.totalTokens);
    }
    if (kind === 'success-rate') {
      return sorted.sort((a, b) => (a.successRate ?? 1) - (b.successRate ?? 1));
    }
    if (kind === 'cost') {
      return sorted.sort((a, b) => b.totalCost - a.totalCost);
    }
    return sorted.sort((a, b) => {
      const toneRank = { CRITICAL: 3, WARNING: 2, ACTIVE: 1, INACTIVE: 0 };
      return (
        toneRank[b.status] - toneRank[a.status] ||
        b.sessionCount24h - a.sessionCount24h
      );
    });
  }

  private createOverview(agents: AgentListItemDto[]): AgentOverviewResponseDto {
    const successRates = agents
      .map((agent) => agent.successRate)
      .filter((value): value is number => typeof value === 'number');
    const latencies = agents
      .map((agent) => agent.avgLatencyMs)
      .filter((value): value is number => typeof value === 'number');

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((agent) => agent.status === 'ACTIVE').length,
      inactiveAgents: agents.filter((agent) => agent.status === 'INACTIVE')
        .length,
      warningAgents: agents.filter((agent) => agent.status === 'WARNING')
        .length,
      criticalAgents: agents.filter((agent) => agent.status === 'CRITICAL')
        .length,
      sessions24h: agents.reduce(
        (sum, agent) => sum + agent.sessionCount24h,
        0,
      ),
      avgSuccessRate: this.average(successRates),
      avgLatencyMs: this.average(latencies),
      totalCost: agents.reduce((sum, agent) => sum + agent.totalCost, 0),
      totalTokens: agents.reduce((sum, agent) => sum + agent.totalTokens, 0),
      topIssue: this.mostCommon(agents.map((agent) => agent.primaryIssue)),
      topAgent: agents[0]?.name,
      recommendation: this.createOverviewRecommendation(agents),
    };
  }

  private createIssueBadges(
    events: EventEntity[],
    sessions: SessionEntity[],
  ): AgentIssueBadgeDto[] {
    const badges = new Map<string, AgentIssueBadgeDto>();
    const addBadge = (badge: AgentIssueBadgeDto) => {
      if (!badges.has(badge.type)) badges.set(badge.type, badge);
    };
    const issues = deriveIssues(events);
    for (const issue of issues) {
      addBadge({
        label: issue.type.replace(/_/g, ' '),
        type: issue.type,
        tone: issue.severity === 'CRITICAL' ? 'bad' : 'warning',
        reason: issue.reason,
      });
    }
    if (sessions.some((session) => session.status === 'FAILED')) {
      addBadge({
        label: '실패 세션',
        type: 'FAILED_SESSIONS',
        tone: 'bad',
        reason: '최근 세션 중 실패한 실행이 있습니다.',
      });
    }
    if (events.some((event) => (event.latency ?? 0) >= 10000)) {
      addBadge({
        label: '느린 단계',
        type: 'HIGH_LATENCY',
        tone: 'warning',
        reason: '10초 이상 걸린 span이 있습니다.',
      });
    }
    if (
      events.some(
        (event) =>
          event.eventType.includes('GUARDRAIL') ||
          event.eventType === 'POLICY_EVALUATION',
      )
    ) {
      addBadge({
        label: '가드레일 개입',
        type: 'GUARDRAIL_EVENT',
        tone: 'warning',
        reason: '정책 판단 또는 차단 이벤트가 기록되었습니다.',
      });
    }
    if (
      events.some((event) =>
        getPayloadBoolean(getPayload(event), 'loopDetected'),
      )
    ) {
      addBadge({
        label: '루프 의심',
        type: 'LOOP_SUSPECTED',
        tone: 'bad',
        reason: '반복 실행 패턴이 감지되었습니다.',
      });
    }

    return Array.from(badges.values()).slice(0, 5);
  }

  private createToolUsage(events: EventEntity[]): AgentToolUsageItemDto[] {
    const buckets = new Map<string, EventEntity[]>();
    for (const event of events) {
      if (!event.eventType.includes('TOOL')) continue;
      const payload = getPayload(event);
      const toolName =
        getPayloadString(payload, 'toolName') ??
        getPayloadString(payload, 'name') ??
        event.label;
      buckets.set(toolName, [...(buckets.get(toolName) ?? []), event]);
    }

    return Array.from(buckets.entries())
      .map(([toolName, toolEvents]) => {
        const failed = toolEvents.filter(
          (event) => getPayload(event).error || event.eventType === 'ERROR',
        );
        const latencies = toolEvents
          .map(
            (event) =>
              event.latency ?? getPayloadNumber(getPayload(event), 'latency'),
          )
          .filter((value): value is number => typeof value === 'number');
        return {
          toolName,
          agentCount: 1,
          callCount: toolEvents.length,
          successRate:
            toolEvents.length === 0
              ? null
              : (toolEvents.length - failed.length) / toolEvents.length,
          avgLatencyMs: this.average(latencies),
          timeoutCount: toolEvents.filter((event) =>
            toDebugString(getPayload(event).error)
              ?.toLowerCase()
              .includes('timeout'),
          ).length,
          sideEffect: this.deriveSideEffect(toolEvents),
          relatedAgents: [],
        };
      })
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10);
  }

  private createSaasAccess(events: EventEntity[]): AgentSaasAccessItemDto[] {
    const buckets = new Map<string, EventEntity[]>();
    for (const event of events) {
      const payload = getPayload(event);
      const appName =
        getPayloadString(payload, 'saasApp') ??
        getPayloadString(payload, 'integration') ??
        getPayloadString(payload, 'service');
      if (!appName) continue;
      buckets.set(appName, [...(buckets.get(appName) ?? []), event]);
    }

    return Array.from(buckets.entries())
      .map(([appName, appEvents]) => {
        const writeCount = appEvents.filter((event) =>
          ['write', 'external', 'destructive'].includes(
            getPayloadString(getPayload(event), 'sideEffect') ?? '',
          ),
        ).length;
        const failureCount = appEvents.filter(
          (event) => getPayload(event).error,
        ).length;
        const riskLevel: AgentSaasAccessItemDto['riskLevel'] =
          writeCount > 5 ? 'high' : writeCount > 0 ? 'medium' : 'low';
        return {
          appName,
          agentCount: 1,
          callCount: appEvents.length,
          writeCount,
          failureCount,
          riskLevel,
          relatedAgents: [],
        };
      })
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10);
  }

  private createBehaviorHistory(
    agent: AgentEntity,
    events: EventEntity[],
  ): AgentBehaviorEventDto[] {
    return this.sortEvents(events)
      .slice(-20)
      .reverse()
      .map((event) => {
        const payload = getPayload(event);
        const severity = payload.error
          ? 'CRITICAL'
          : event.eventType.includes('GUARDRAIL')
            ? 'WARNING'
            : 'INFO';
        return {
          id: event.id,
          agentId: agent.id,
          agentName: agent.name,
          timestamp: event.timestamp.toISOString(),
          eventType: event.eventType,
          summary:
            createPreview(payload.output ?? payload.result ?? payload.error) ??
            event.label,
          severity,
          sessionId: event.session?.id,
          traceId: getPayloadString(payload, 'traceId'),
        };
      });
  }

  private createTrend(sessions: SessionEntity[]): AgentMetricPointDto[] {
    const buckets = new Map<string, SessionEntity[]>();
    for (const session of sessions) {
      const hour = new Date(session.startedAt);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      buckets.set(key, [...(buckets.get(key) ?? []), session]);
    }

    return Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-72)
      .map(([timestamp, bucket]) => {
        const successCount = bucket.filter(
          (session) => session.status === 'COMPLETED',
        ).length;
        const failedCount = bucket.filter(
          (session) =>
            session.status === 'FAILED' || session.status === 'CANCELLED',
        ).length;
        const latencies = bucket
          .map((session) => this.getDurationMs(session))
          .filter((value): value is number => typeof value === 'number');
        return {
          timestamp,
          value: bucket.length,
          successCount,
          failedCount,
          cost: bucket.reduce(
            (sum, session) => sum + Number(session.totalCost ?? 0),
            0,
          ),
          tokens: bucket.reduce(
            (sum, session) => sum + (session.totalTokens ?? 0),
            0,
          ),
          latencyMs: this.average(latencies) ?? undefined,
        };
      });
  }

  private deriveStatus(
    lastRunAt: Date | undefined,
    successRate: number | null,
    issueBadges: AgentIssueBadgeDto[],
  ): AgentStatus {
    if (!lastRunAt || Date.now() - lastRunAt.getTime() > INACTIVE_WINDOW_MS) {
      return 'INACTIVE';
    }
    if (issueBadges.some((badge) => badge.tone === 'bad')) return 'CRITICAL';
    if ((successRate ?? 1) < 0.95 || issueBadges.length > 0) return 'WARNING';
    return 'ACTIVE';
  }

  private createRecommendations(item: AgentListItemDto) {
    const recommendations: AgentDetailResponseDto['recommendations'] = [];
    if ((item.failureRate ?? 0) > 0.05) {
      recommendations.push({
        title: '실패율이 높은 에이전트입니다',
        description: '최근 실패 세션과 디버깅 로그를 먼저 확인하세요.',
        priority: 'HIGH',
        href: `/dashboard/session/failed?agentId=${item.agentId}`,
      });
    }
    if ((item.p95LatencyMs ?? 0) > 10000) {
      recommendations.push({
        title: '느린 span을 확인하세요',
        description: '툴 호출, RAG, 모델 대기 시간 중 병목 후보를 확인하세요.',
        priority: 'MEDIUM',
        href: `/debug/bottleneck?agentId=${item.agentId}`,
      });
    }
    if (item.guardrailCount > 0) {
      recommendations.push({
        title: '정책 개입 이력을 검토하세요',
        description:
          '가드레일 차단 또는 승인 필요 이벤트가 반복되는지 확인하세요.',
        priority: 'MEDIUM',
        href: `/debug/logs?agentId=${item.agentId}`,
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        title: '운영 상태가 안정적입니다',
        description:
          '성공률과 지연 시간이 정상 범위입니다. 비용 추세만 주기적으로 확인하세요.',
        priority: 'LOW',
      });
    }
    return recommendations;
  }

  private createPrimaryRecommendation(badges: AgentIssueBadgeDto[]) {
    const top = badges[0];
    if (!top) return '최근 실행 기준으로 뚜렷한 이상 신호는 없습니다.';
    if (top.type === 'HIGH_LATENCY')
      return '느린 span과 외부 tool 응답 시간을 확인하세요.';
    if (top.type === 'GUARDRAIL_EVENT')
      return '정책 개입 사유와 위험 tool 호출을 확인하세요.';
    if (top.type === 'LOOP_SUSPECTED')
      return '반복 tool call 또는 같은 응답 반복 패턴을 확인하세요.';
    return top.reason ?? '관련 세션과 디버깅 로그를 확인하세요.';
  }

  private createOverviewRecommendation(agents: AgentListItemDto[]) {
    const critical = agents.find((agent) => agent.status === 'CRITICAL');
    if (critical) {
      return `${critical.name}에서 치명적인 실행 신호가 감지되었습니다. 관련 세션과 디버깅 로그를 먼저 확인하세요.`;
    }
    const warning = agents.find((agent) => agent.status === 'WARNING');
    if (warning) {
      return `${warning.name}에서 주의가 필요한 실행 패턴이 있습니다. 실패율, 지연 시간, 가드레일 이벤트를 확인하세요.`;
    }
    return '최근 에이전트 실행 상태가 안정적입니다.';
  }

  private deriveSideEffect(
    events: EventEntity[],
  ): AgentToolUsageItemDto['sideEffect'] {
    const values = events
      .map((event) => getPayloadString(getPayload(event), 'sideEffect'))
      .filter((value): value is string => Boolean(value));
    if (values.includes('destructive')) return 'destructive';
    if (values.includes('external')) return 'external';
    if (values.includes('write')) return 'write';
    if (values.includes('read-only')) return 'read-only';
    return 'unknown';
  }

  private matchesSearch(agent: AgentListItemDto, search: string) {
    const values = [
      agent.name,
      agent.description,
      agent.role,
      agent.owner,
      agent.team,
      agent.group,
      agent.environment,
      agent.defaultModel,
      agent.primaryIssue,
      agent.recommendation,
      ...agent.models,
      ...agent.tools,
      ...agent.saasApps,
      ...agent.issueBadges.flatMap((badge) => [
        badge.label,
        badge.type,
        badge.reason,
      ]),
    ];
    return values.some((value) => value?.toLowerCase().includes(search));
  }

  private firstPayloadString(events: EventEntity[], key: string) {
    for (const event of events) {
      const value = getPayloadString(getPayload(event), key);
      if (value) return value;
    }
    return undefined;
  }

  private uniquePayloadStrings(events: EventEntity[], key: string) {
    return Array.from(
      new Set(
        events
          .map((event) => getPayloadString(getPayload(event), key))
          .filter((value): value is string => Boolean(value)),
      ),
    ).slice(0, 10);
  }

  private uniqueTools(events: EventEntity[]) {
    return Array.from(
      new Set(
        events
          .filter((event) => event.eventType.includes('TOOL'))
          .map((event) => {
            const payload = getPayload(event);
            return (
              getPayloadString(payload, 'toolName') ??
              getPayloadString(payload, 'name') ??
              event.label
            );
          })
          .filter(Boolean),
      ),
    ).slice(0, 10);
  }

  private uniqueSaasApps(events: EventEntity[]) {
    return Array.from(
      new Set(
        events
          .map((event) => {
            const payload = getPayload(event);
            return (
              getPayloadString(payload, 'saasApp') ??
              getPayloadString(payload, 'integration') ??
              getPayloadString(payload, 'service')
            );
          })
          .filter((value): value is string => Boolean(value)),
      ),
    ).slice(0, 10);
  }

  private getDurationMs(session: SessionEntity) {
    const end = session.endedAt ?? new Date();
    return end.getTime() - session.startedAt.getTime();
  }

  private sortEvents(events: EventEntity[]) {
    return [...events].sort(
      (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
    );
  }

  private average(values: number[]) {
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private percentile(values: number[], percentile: number) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.ceil((percentile / 100) * sorted.length) - 1,
    );
    return sorted[index] ?? null;
  }

  private mostCommon(values: Array<string | undefined>) {
    const counts = new Map<string, number>();
    values.forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    let winner: string | undefined;
    let max = 0;
    counts.forEach((count, value) => {
      if (count > max) {
        winner = value;
        max = count;
      }
    });
    return winner;
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_AGENT_LIMIT, 1), MAX_AGENT_LIMIT);
  }

  private createPageInfo(
    visible: AgentListItemDto[],
    hasMore: boolean,
    total: number,
  ): AgentPageInfoDto {
    const lastVisible = visible.at(-1);
    return {
      hasMore,
      total,
      nextCursor:
        hasMore && lastVisible
          ? this.encodeCursor(lastVisible.name, lastVisible.agentId)
          : undefined,
    };
  }

  private decodeCursor(cursor?: string): CursorValue | undefined {
    if (!cursor) return undefined;
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as CursorValue;
      if (!parsed.name || !parsed.id) throw new Error('Invalid cursor.');
      return parsed;
    } catch {
      throw new BadRequestException({ message: 'Invalid pagination cursor.' });
    }
  }

  private encodeCursor(name: string, id: string) {
    return Buffer.from(JSON.stringify({ name, id }), 'utf8').toString(
      'base64url',
    );
  }
}
