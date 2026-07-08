import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEntity, SessionEntity } from '@repo/database';
import {
  SessionDetailQueryDto,
  SessionDetailResponseDto,
  SessionFlowEdgeDto,
  SessionFlowNodeDto,
  SessionFlowNodeStatus,
  SessionFlowNodeType,
  SessionIssueBadgeDto,
  SessionListItemDto,
  SessionListQueryDto,
  SessionListResponseDto,
  SessionOverviewResponseDto,
  SessionPageInfoDto,
  SessionSeverity,
  SessionTimelineResponseDto,
} from '@repo/dto';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import {
  createPreview,
  toDebugString,
} from '../../common/utils/debug-preview.utils';
import { deriveIssues } from '../../common/utils/debug-issue.utils';
import { maxSeverity } from '../../common/utils/debug-severity.utils';
import { getSpanId } from '../../common/utils/timeline.utils';
import { EventPayload } from '../../common/types/debug-event.types';
import {
  getPayload,
  getPayloadBoolean,
  getPayloadNumber,
  getPayloadString,
} from '../../common/utils/event-payload.utils';
import {
  DEFAULT_SESSION_LIMIT,
  MAX_SESSION_LIMIT,
  MAX_TIMELINE_EVENTS,
} from '../../common/constants/session.constants';
import { SessionCursorValue } from '../../common/types/session.types';

@Injectable()
export class SessionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async listSessions(
    query: SessionListQueryDto,
    userId: string,
  ): Promise<SessionListResponseDto> {
    await this.workspaceAccess.assertAccess(userId, query.workspaceId);

    const limit = this.normalizeLimit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const qb = this.dataSource
      .getRepository(SessionEntity)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .leftJoinAndSelect('session.events', 'event')
      .where('session.workspaceId = :workspaceId', {
        workspaceId: query.workspaceId,
      })
      .orderBy('session.startedAt', 'DESC')
      .addOrderBy('session.id', 'DESC')
      .take(limit + 1);

    if (query.agentId) {
      qb.andWhere('session.agentId = :agentId', { agentId: query.agentId });
    }
    if (query.agent) {
      qb.andWhere('agent.name ILIKE :agent', { agent: `%${query.agent}%` });
    }
    if (query.sessionId) {
      qb.andWhere('session.id = :sessionId', { sessionId: query.sessionId });
    }
    if (query.runId) {
      qb.andWhere(
        "(session.name = :runId OR event.payload->>'runId' = :runId OR event.payload->>'traceId' = :runId)",
        { runId: query.runId },
      );
    }
    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('session.startedAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('session.startedAt <= :to', { to: new Date(query.to) });
    }
    if (query.traceId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM "event" trace_event WHERE trace_event."sessionId" = session.id AND trace_event.payload->>\'traceId\' ILIKE :traceId)',
        { traceId: `%${query.traceId}%` },
      );
    }
    if (query.environment) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM "event" environment_event WHERE environment_event."sessionId" = session.id AND environment_event.payload->>\'environment\' ILIKE :environment)',
        { environment: `%${query.environment}%` },
      );
    }
    if (query.search) {
      qb.andWhere(
        '(session.id ILIKE :search OR session.name ILIKE :search OR agent.name ILIKE :search OR EXISTS (SELECT 1 FROM "event" search_event WHERE search_event."sessionId" = session.id AND (search_event.label ILIKE :search OR search_event."eventType" ILIKE :search OR search_event.payload::text ILIKE :search)))',
        { search: `%${query.search}%` },
      );
    }
    if (cursor) {
      qb.andWhere(
        '(session.startedAt < :cursorTimestamp OR (session.startedAt = :cursorTimestamp AND session.id < :cursorId))',
        {
          cursorTimestamp: new Date(cursor.timestamp),
          cursorId: cursor.id,
        },
      );
    }

    const sessions = await qb.getMany();
    const visible = sessions.slice(0, limit);
    const mapped = visible.map((session) => this.toListItem(session));
    const filtered = this.applyListFilters(
      this.filterByKind(mapped, query.kind),
      query,
    );

    return {
      overview: this.createOverview(filtered),
      sessions: filtered,
      page: this.createPageInfo(sessions, limit, (session) =>
        this.encodeCursor(session.startedAt, session.id),
      ),
    };
  }

  async getDetail(
    sessionId: string,
    query: SessionDetailQueryDto,
    userId: string,
  ): Promise<SessionDetailResponseDto> {
    await this.workspaceAccess.assertAccess(userId, query.workspaceId);
    const session = await this.findSessionOrThrow(query.workspaceId, sessionId);
    const events = await this.getSessionEvents(query.workspaceId, sessionId);
    return this.toDetail({ ...session, events } as SessionEntity);
  }

  async getTimeline(
    sessionId: string,
    query: SessionDetailQueryDto,
    userId: string,
  ): Promise<SessionTimelineResponseDto> {
    await this.workspaceAccess.assertAccess(userId, query.workspaceId);
    const session = await this.findSessionOrThrow(query.workspaceId, sessionId);
    const events = await this.getSessionEvents(query.workspaceId, sessionId);
    const nodes = events.map((event, index) =>
      this.toFlowNode(event, index, events),
    );
    const spanNodeIds = new Map<string, string>();
    events.forEach((event, index) => {
      const spanId = getSpanId(event);
      if (spanId && !spanNodeIds.has(spanId)) {
        spanNodeIds.set(spanId, nodes[index].id);
      }
    });
    const normalizedNodes = nodes.map((node, index) => {
      const parentSpanId = getPayloadString(
        getPayload(events[index]),
        'parentSpanId',
      );
      const parentId = parentSpanId
        ? spanNodeIds.get(parentSpanId)
        : node.parentId;

      return {
        ...node,
        parentId: parentId && parentId !== node.id ? parentId : undefined,
      };
    });
    const nodeIds = new Set(normalizedNodes.map((node) => node.id));
    const edges = normalizedNodes
      .map((node, index): SessionFlowEdgeDto | undefined => {
        const previous = normalizedNodes[index - 1];
        const source =
          node.parentId && nodeIds.has(node.parentId)
            ? node.parentId
            : previous?.id;
        if (!source) return undefined;
        return {
          id: `${source}->${node.id}-${index}`,
          source,
          target: node.id,
          status: this.toEdgeStatus(node),
          label: node.type === 'retry' ? 'retry' : undefined,
        };
      })
      .filter((edge): edge is SessionFlowEdgeDto => Boolean(edge));
    const failedNode = normalizedNodes.find((node) => node.status === 'error');
    const criticalNodeIds = normalizedNodes
      .filter((node) => node.status === 'error' || node.issueBadges.length > 0)
      .map((node) => node.id);

    return {
      session: this.toDetail({ ...session, events } as SessionEntity),
      nodes: normalizedNodes,
      edges,
      criticalNodeIds,
      failedNodeId: failedNode?.id,
    };
  }

  private filterByKind(
    sessions: SessionListItemDto[],
    kind: SessionListQueryDto['kind'],
  ) {
    if (!kind || kind === 'overview') return sessions;
    if (kind === 'live') {
      return sessions.filter((session) => session.status === 'RUNNING');
    }
    if (kind === 'completed') {
      return sessions.filter(
        (session) =>
          session.status === 'COMPLETED' && session.severity !== 'CRITICAL',
      );
    }
    if (kind === 'failed') {
      return sessions.filter(
        (session) =>
          session.status === 'FAILED' ||
          session.status === 'CANCELLED' ||
          session.severity === 'CRITICAL',
      );
    }
    return sessions.filter(
      (session) =>
        session.status !== 'FAILED' &&
        session.status !== 'CANCELLED' &&
        session.issueBadges.length > 0,
    );
  }

  private applyListFilters(
    sessions: SessionListItemDto[],
    query: SessionListQueryDto,
  ) {
    const textSearch = query.search?.trim().toLowerCase();
    const agentSearch = query.agent?.trim().toLowerCase();
    const environmentSearch = query.environment?.trim().toLowerCase();
    const traceSearch = query.traceId?.trim().toLowerCase();

    return sessions.filter((session) => {
      if (
        agentSearch &&
        !session.agentName.toLowerCase().includes(agentSearch) &&
        !session.agentId.toLowerCase().includes(agentSearch)
      ) {
        return false;
      }
      if (
        environmentSearch &&
        !session.environment?.toLowerCase().includes(environmentSearch)
      ) {
        return false;
      }
      if (
        traceSearch &&
        !session.traceId?.toLowerCase().includes(traceSearch)
      ) {
        return false;
      }
      if (textSearch && !this.matchesSearchText(session, textSearch)) {
        return false;
      }
      return true;
    });
  }

  private matchesSearchText(session: SessionListItemDto, search: string) {
    const searchableValues = [
      session.sessionId,
      session.runId,
      session.traceId,
      session.agentId,
      session.agentName,
      session.environment,
      session.status,
      session.severity,
      session.primaryIssue,
      session.rootCauseCandidate,
      ...session.issueBadges.flatMap((badge) => [
        badge.label,
        badge.type,
        badge.reason,
      ]),
    ];

    return searchableValues.some((value) =>
      value?.toLowerCase().includes(search),
    );
  }

  private toListItem(session: SessionEntity): SessionListItemDto {
    const events = this.sortEvents(session.events ?? []);
    const issues = deriveIssues(events);
    const severity = issues.reduce<SessionSeverity>(
      (current, issue) => maxSeverity(current, issue.severity),
      'INFO',
    );
    const llmCallCount = events.filter((event) =>
      event.eventType.includes('LLM'),
    ).length;
    const toolCallCount = events.filter((event) =>
      event.eventType.includes('TOOL'),
    ).length;
    const retryCount = events.filter(
      (event) =>
        event.eventType.includes('RETRY') ||
        getPayloadNumber(getPayload(event), 'retryCount'),
    ).length;
    const errorCount = events.filter(
      (event) => event.eventType === 'ERROR' || getPayload(event).error,
    ).length;
    const guardrailCount = events.filter(
      (event) =>
        event.eventType.includes('GUARDRAIL') ||
        event.eventType === 'POLICY_EVALUATION',
    ).length;
    const issueBadges = this.toIssueBadges(events);
    const primaryIssue = issues[0]?.type ?? issueBadges[0]?.type;
    const runId = this.getSessionRunId(session, events);
    const traceId = this.getSessionTraceId(session, events, runId);

    return {
      sessionId: session.id,
      runId,
      traceId,
      agentId: session.agent?.id ?? '',
      agentName: session.agent?.name ?? 'Unknown Agent',
      status: session.status as SessionListItemDto['status'],
      severity,
      environment:
        getPayloadString(getPayload(events[0]), 'environment') ?? 'production',
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      durationMs: this.getDurationMs(session),
      llmCallCount,
      toolCallCount,
      retryCount,
      errorCount,
      guardrailCount,
      totalTokens: session.totalTokens ?? 0,
      totalCost: Number(session.totalCost ?? 0),
      primaryIssue,
      rootCauseCandidate: issues[0]?.reason ?? issueBadges[0]?.reason,
      issueBadges,
      relatedDebugLinks: this.toDebugLinks(session.id),
    };
  }

  private toDetail(session: SessionEntity): SessionDetailResponseDto {
    const item = this.toListItem(session);
    const events = this.sortEvents(session.events ?? []);
    const llmEvents = events.filter((event) => event.eventType.includes('LLM'));
    const toolEvents = events.filter((event) =>
      event.eventType.includes('TOOL'),
    );
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    return {
      ...item,
      inputPreview: firstEvent
        ? createPreview(getPayload(firstEvent).input ?? getPayload(firstEvent))
        : undefined,
      finalOutputPreview: lastEvent
        ? createPreview(getPayload(lastEvent).output ?? getPayload(lastEvent))
        : undefined,
      modelNames: Array.from(
        new Set(
          llmEvents
            .map((event) => getPayloadString(getPayload(event), 'model'))
            .filter((value): value is string => Boolean(value)),
        ),
      ),
      toolNames: Array.from(
        new Set(
          toolEvents
            .map((event) => getPayloadString(getPayload(event), 'toolName'))
            .filter((value): value is string => Boolean(value)),
        ),
      ),
      promptVersion: getPayloadString(
        getPayload(llmEvents[0]),
        'promptVersion',
      ),
      sdkVersion: getPayloadString(getPayload(firstEvent), 'sdkVersion'),
      recommendedActions: [
        {
          label: '추론 트레이스 보기',
          href: `/debug/trace/${session.id}`,
          description: 'span 구조와 critical path를 더 깊게 확인합니다.',
        },
        {
          label: '재현 환경 열기',
          href: `/debug/reproduce/${session.id}`,
          description: '원본 실행과 dry-run 재현 가능성을 비교합니다.',
        },
        {
          label: '에러 리포트 보기',
          href: '/debug/errors',
          description: '반복되는 에러 그룹과 영향 범위를 확인합니다.',
        },
      ],
    };
  }

  private toFlowNode(
    event: EventEntity,
    index: number,
    events: EventEntity[],
  ): SessionFlowNodeDto {
    const payload = getPayload(event);
    const type = this.toNodeType(event);
    const issues = deriveIssues([event]);
    const usage = payload.usage;
    const tokenCount =
      typeof usage === 'object' && usage
        ? getPayloadNumber(usage as EventPayload, 'totalTokens')
        : getPayloadNumber(payload, 'totalTokens');

    return {
      id: event.id,
      eventId: event.id,
      type,
      label: event.label,
      status: this.toNodeStatus(event),
      timestamp: event.timestamp.toISOString(),
      latencyMs: event.latency ?? getPayloadNumber(payload, 'latency'),
      tokenCount,
      cost: Number(event.cost ?? payload.cost ?? 0),
      model: getPayloadString(payload, 'model'),
      provider: getPayloadString(payload, 'provider'),
      toolName: getPayloadString(payload, 'toolName'),
      parentId:
        getPayloadString(payload, 'parentSpanId') ??
        (index > 0 ? events[index - 1].id : undefined),
      issueBadges: issues.map((issue) => ({
        label: issue.type.replace(/_/g, ' '),
        type: issue.type,
        tone: issue.severity === 'CRITICAL' ? 'bad' : 'warning',
        reason: issue.reason,
      })),
      preview:
        createPreview(payload.output ?? payload.result ?? payload.message) ??
        event.label,
      detail: {
        eventType: event.eventType,
        inputPreview: createPreview(payload.input ?? payload.args),
        outputPreview: createPreview(payload.output ?? payload.result),
        error: toDebugString(payload.error),
        argumentsPreview: createPreview(payload.arguments ?? payload.args),
        resultPreview: createPreview(payload.result ?? payload.output),
        raw: this.canExposeRawPayloads() ? payload : undefined,
      },
    };
  }

  private canExposeRawPayloads() {
    return process.env.LYNX_EXPOSE_RAW_PAYLOADS === 'true';
  }

  private toIssueBadges(events: EventEntity[]): SessionIssueBadgeDto[] {
    const badges = new Map<string, SessionIssueBadgeDto>();
    const addBadge = (badge: SessionIssueBadgeDto) => {
      if (!badges.has(badge.type)) badges.set(badge.type, badge);
    };

    for (const issue of deriveIssues(events)) {
      addBadge({
        label: issue.type.replace(/_/g, ' '),
        type: issue.type,
        tone: issue.severity === 'CRITICAL' ? 'bad' : 'warning',
        reason: issue.reason,
      });
    }
    for (const event of events) {
      const payload = getPayload(event);
      const latency = event.latency ?? getPayloadNumber(payload, 'latency');
      const retryCount = getPayloadNumber(payload, 'retryCount') ?? 0;
      if (latency && latency >= 10000) {
        addBadge({
          label: 'High latency',
          type: 'HIGH_LATENCY',
          tone: 'warning',
          reason: `${event.label} took ${Math.round(latency)}ms.`,
        });
      }
      if (retryCount >= 3) {
        addBadge({
          label: `Retry x${retryCount}`,
          type: 'MANY_RETRIES',
          tone: 'warning',
          reason: `${event.label} retried ${retryCount} times.`,
        });
      }
      if (getPayloadBoolean(payload, 'loopDetected')) {
        addBadge({
          label: 'Loop suspected',
          type: 'LOOP_SUSPECTED',
          tone: 'bad',
          reason: 'Repeated action pattern was detected.',
        });
      }
      if (event.eventType === 'POLICY_EVALUATION') {
        addBadge({
          label: 'Guardrail event',
          type: 'GUARDRAIL_EVENT',
          tone: 'warning',
          reason: toDebugString(payload.reason),
        });
      }
    }

    return Array.from(badges.values()).slice(0, 5);
  }

  private createOverview(
    sessions: SessionListItemDto[],
  ): SessionOverviewResponseDto {
    const completed = sessions.filter(
      (session) => session.status === 'COMPLETED',
    );
    const failed = sessions.filter(
      (session) =>
        session.status === 'FAILED' ||
        session.status === 'CANCELLED' ||
        session.severity === 'CRITICAL',
    );
    const anomalies = sessions.filter(
      (session) => session.issueBadges.length > 0,
    );
    const durations = sessions
      .map((session) => session.durationMs)
      .filter((value): value is number => typeof value === 'number');

    return {
      totalSessions: sessions.length,
      runningSessions: sessions.filter(
        (session) => session.status === 'RUNNING',
      ).length,
      completedSessions: completed.length,
      failedSessions: failed.length,
      anomalySessions: anomalies.length,
      successRate:
        sessions.length === 0 ? null : completed.length / sessions.length,
      avgDurationMs:
        durations.length === 0
          ? null
          : durations.reduce((sum, value) => sum + value, 0) / durations.length,
      totalCost: sessions.reduce((sum, session) => sum + session.totalCost, 0),
      totalTokens: sessions.reduce(
        (sum, session) => sum + session.totalTokens,
        0,
      ),
      topIssue: this.mostCommon(
        sessions.map((session) => session.primaryIssue),
      ),
      topAgent: this.mostCommon(sessions.map((session) => session.agentName)),
    };
  }

  private toDebugLinks(sessionId: string) {
    return [
      {
        label: '추론 트레이스',
        href: `/debug/trace/${sessionId}`,
        kind: 'trace' as const,
      },
      {
        label: '재현 환경',
        href: `/debug/reproduce/${sessionId}`,
        kind: 'reproduce' as const,
      },
      {
        label: '원인 후보',
        href: `/debug/root-cause/${sessionId}`,
        kind: 'root-cause' as const,
      },
    ];
  }

  private getSessionRunId(session: SessionEntity, events: EventEntity[]) {
    const firstPayload = getPayload(events[0]);
    return (
      getPayloadString(firstPayload, 'runId') ??
      getPayloadString(firstPayload, 'traceId') ??
      session.name
    );
  }

  private getSessionTraceId(
    session: SessionEntity,
    events: EventEntity[],
    runId: string,
  ) {
    return (
      getPayloadString(getPayload(events[0]), 'traceId') ?? runId ?? session.id
    );
  }

  private toNodeType(event: EventEntity): SessionFlowNodeType {
    const type = event.eventType;
    if (type === 'USER_INPUT') return 'user_input';
    if (type === 'CONTEXT_RETRIEVAL') return 'context_load';
    if (type === 'MEMORY_ACCESS') return 'memory_read';
    if (type === 'POLICY_EVALUATION' || type.includes('GUARDRAIL'))
      return 'guardrail_check';
    if (type.includes('LLM')) return 'llm_call';
    if (type.includes('TOOL')) return 'tool_call';
    if (type.includes('RETRY')) return 'retry';
    if (type === 'ERROR') return 'error';
    if (type === 'SESSION_OUTCOME') return 'final_response';
    return getPayload(event).error ? 'error' : 'prompt_build';
  }

  private toNodeStatus(event: EventEntity): SessionFlowNodeStatus {
    const payload = getPayload(event);
    if (event.eventType === 'ERROR' || payload.error) return 'error';
    if (event.eventType === 'POLICY_EVALUATION') {
      const action = getPayloadString(payload, 'action');
      if (action === 'BLOCK' || action === 'REQUIRE_APPROVAL') return 'blocked';
      return 'warning';
    }
    if ((event.latency ?? getPayloadNumber(payload, 'latency') ?? 0) >= 10000) {
      return 'warning';
    }
    if (getPayloadString(payload, 'phase') === 'start') return 'running';
    return 'success';
  }

  private toEdgeStatus(node: SessionFlowNodeDto): SessionFlowEdgeDto['status'] {
    if (node.status === 'error') return 'error';
    if (node.status === 'blocked') return 'blocked';
    if (node.type === 'retry') return 'retry';
    return 'normal';
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

  private normalizeLimit(limit?: number) {
    return Math.min(
      Math.max(limit ?? DEFAULT_SESSION_LIMIT, 1),
      MAX_SESSION_LIMIT,
    );
  }

  private createPageInfo<T>(
    items: T[],
    limit: number,
    getCursor: (item: T) => string,
  ): SessionPageInfoDto {
    const hasMore = items.length > limit;
    const lastVisible = items.slice(0, limit).at(-1);
    return {
      hasMore,
      nextCursor: hasMore && lastVisible ? getCursor(lastVisible) : undefined,
    };
  }

  private decodeCursor(cursor?: string): SessionCursorValue | undefined {
    if (!cursor) return undefined;
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as SessionCursorValue;
      if (!parsed.timestamp || !parsed.id) throw new Error('Invalid cursor.');
      return parsed;
    } catch {
      throw new BadRequestException({ message: 'Invalid pagination cursor.' });
    }
  }

  private encodeCursor(timestamp: Date, id: string) {
    return Buffer.from(
      JSON.stringify({ timestamp: timestamp.toISOString(), id }),
      'utf8',
    ).toString('base64url');
  }

  private async findSessionOrThrow(workspaceId: string, sessionId: string) {
    const session = await this.dataSource
      .getRepository(SessionEntity)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .leftJoinAndSelect('session.events', 'event')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.workspaceId = :workspaceId', { workspaceId })
      .getOne();

    if (!session) {
      throw new NotFoundException({ message: 'Session not found.' });
    }
    return session;
  }

  private async getSessionEvents(workspaceId: string, sessionId: string) {
    const events = await this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.session', 'session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.workspaceId = :workspaceId', { workspaceId })
      .orderBy('event.timestamp', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .take(MAX_TIMELINE_EVENTS + 1)
      .getMany();

    if (events.length > MAX_TIMELINE_EVENTS) {
      throw new BadRequestException({
        message:
          'This session has too many events for an interactive timeline view.',
      });
    }
    return events;
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
}
