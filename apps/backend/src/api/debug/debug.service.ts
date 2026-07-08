import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { EventEntity, SessionEntity } from '@repo/database';
import {
  DebugAnalysisQueryDto,
  DebugBottleneckResponseDto,
  DebugEventLogItemDto,
  DebugEventLogQueryDto,
  DebugEventLogResponseDto,
  DebugFailurePatternResponseDto,
  DebugErrorGroupListResponseDto,
  DebugLatencyResponseDto,
  DebugLlmCallListResponseDto,
  DebugMemoryResponseDto,
  DebugPageInfoDto,
  DebugPolicySimulationRequestDto,
  DebugPolicySimulationResponseDto,
  DebugReproduceRequestDto,
  DebugReproduceResponseDto,
  DebugRootCauseResponseDto,
  DebugSearchQueryDto,
  DebugSessionListQueryDto,
  DebugSessionListResponseDto,
  DebugSessionSummaryDto,
  DebugTimelineNodeDto,
  DebugTimelineQueryDto,
  DebugTimelineResponseDto,
  DebugToolCallListResponseDto,
  DebugRiskCategory,
  DebugSeverity,
} from '@repo/dto';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { average, percentile } from '../../common/utils/statistics.utils';
import {
  calculateCriticalPath,
  getSpanId,
} from '../../common/utils/timeline.utils';
import { computeSeverity } from '../../common/utils/debug-severity.utils';
import { createFailureSignature } from '../../common/utils/fingerprint.utils';
import {
  createPreview,
  toDebugString,
} from '../../common/utils/debug-preview.utils';
import { deriveIssues } from '../../common/utils/debug-issue.utils';
import { EventPayload } from '../../common/types/debug-event.types';
import {
  getPayload,
  getPayloadBoolean,
  getPayloadNumber,
  getPayloadRiskLevel,
  getPayloadString,
} from '../../common/utils/event-payload.utils';
import {
  MAX_ANALYSIS_EVENTS,
  MAX_SESSION_EVENTS,
} from '../../common/constants/debug.constants';
import {
  canExposeRawDebugPayloads,
  createDebugPageInfo,
  decodeDebugCursor,
  encodeDebugCursor,
  findFirstPayloadString,
  getDebugDateRange,
  getDebugSeverityRank,
  isDebugReplayable,
  normalizeDebugLimit,
  normalizeDebugPolicyResult,
  toDebugBottleneckType,
  toDebugEventLogItem,
  toDebugLatencyBuckets,
  toDebugLlmCallItem,
  toDebugRootCauseCategory,
  toDebugRiskCategory,
  toDebugSessionSummary,
  toDebugTimelineNode,
  toDebugToolCallItem,
} from '../../common/utils/debug-service.utils';

@Injectable()
export class DebugService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async listSessions(
    query: DebugSessionListQueryDto,
    userId: string,
  ): Promise<DebugSessionListResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const limit = normalizeDebugLimit(query.limit);
    const cursor = decodeDebugCursor(query.cursor);

    const qb = this.dataSource
      .getRepository(SessionEntity)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .leftJoinAndSelect('session.events', 'event')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .orderBy('session.startedAt', 'DESC')
      .addOrderBy('session.id', 'DESC')
      .take(limit + 1);

    if (query.agentId) {
      qb.andWhere('session.agentId = :agentId', { agentId: query.agentId });
    }
    if (query.sessionId) {
      qb.andWhere('session.id = :sessionId', { sessionId: query.sessionId });
    }
    if (query.runId) {
      qb.andWhere('session.name = :runId', { runId: query.runId });
    }
    if (query.status) {
      qb.andWhere('session.status = :status', { status: query.status });
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
    const summaries = visible
      .map((session) => toDebugSessionSummary(session))
      .filter((summary) => {
        if (query.severity && summary.severity !== query.severity) {
          return false;
        }
        if (query.issueType && summary.primaryIssue !== query.issueType) {
          return false;
        }
        if (query.anomalyOnly && summary.issueCount === 0) {
          return false;
        }
        return true;
      });

    return {
      sessions: summaries,
      page: createDebugPageInfo(sessions, limit, (session) =>
        encodeDebugCursor(session.startedAt, session.id),
      ),
    };
  }

  async listSessionEvents(
    sessionId: string,
    query: DebugEventLogQueryDto,
    userId: string,
  ): Promise<DebugEventLogResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    await this.findSessionOrThrow(workspaceId, sessionId);

    const limit = normalizeDebugLimit(query.limit);
    const cursor = decodeDebugCursor(query.cursor);
    const qb = this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.session', 'session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.workspaceId = :workspaceId', { workspaceId })
      .orderBy('event.timestamp', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(limit + 1);

    if (query.eventType) {
      qb.andWhere('event.eventType = :eventType', {
        eventType: query.eventType,
      });
    }
    if (query.label) {
      qb.andWhere('event.label ILIKE :label', { label: `%${query.label}%` });
    }
    if (query.errorsOnly) {
      qb.andWhere(
        '(event.eventType = :errorType OR event.payload ? :errorKey)',
        {
          errorType: 'ERROR',
          errorKey: 'error',
        },
      );
    }
    if (query.phase) {
      if (query.phase === 'error') {
        qb.andWhere(
          "(event.eventType = :phaseErrorType OR event.payload->>'phase' = :phase OR event.payload ? :phaseErrorKey)",
          {
            phase: query.phase,
            phaseErrorType: 'ERROR',
            phaseErrorKey: 'error',
          },
        );
      } else if (query.phase === 'single') {
        qb.andWhere(
          "(event.payload->>'phase' = :phase OR event.payload->>'phase' IS NULL)",
          { phase: query.phase },
        );
      } else {
        qb.andWhere("event.payload->>'phase' = :phase", {
          phase: query.phase,
        });
      }
    }
    if (cursor) {
      qb.andWhere(
        '(event.timestamp < :cursorTimestamp OR (event.timestamp = :cursorTimestamp AND event.id < :cursorId))',
        {
          cursorTimestamp: new Date(cursor.timestamp),
          cursorId: cursor.id,
        },
      );
    }

    const events = await qb.getMany();
    const visible = events.slice(0, limit);
    const mapped = visible
      .map((event) => toDebugEventLogItem(event))
      .filter((event) => {
        if (query.severity && event.severity !== query.severity) return false;
        return true;
      });

    return {
      events: mapped,
      page: createDebugPageInfo(events, limit, (event) =>
        encodeDebugCursor(event.timestamp, event.id),
      ),
    };
  }

  async listEvents(
    query: DebugEventLogQueryDto,
    userId: string,
  ): Promise<DebugEventLogResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const { items, page } = await this.getPagedEvents(workspaceId, query);

    return {
      events: items.map((event) => toDebugEventLogItem(event)),
      page,
    };
  }

  async listToolCalls(
    query: DebugEventLogQueryDto,
    userId: string,
  ): Promise<DebugToolCallListResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const { items, page } = await this.getPagedEvents(
      workspaceId,
      query,
      (qb) =>
        qb.andWhere(
          '(event.eventType ILIKE :toolType OR event.payload ? :toolNameKey)',
          { toolType: '%TOOL%', toolNameKey: 'toolName' },
        ),
    );

    return {
      toolCalls: items.map((event) => toDebugToolCallItem(event)),
      page,
    };
  }

  async listLlmCalls(
    query: DebugEventLogQueryDto,
    userId: string,
  ): Promise<DebugLlmCallListResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const { items, page } = await this.getPagedEvents(
      workspaceId,
      query,
      (qb) =>
        qb.andWhere(
          '(event.eventType ILIKE :llmType OR event.payload ? :modelKey)',
          { llmType: '%LLM%', modelKey: 'model' },
        ),
    );

    return {
      llmCalls: items.map((event) => toDebugLlmCallItem(event)),
      page,
    };
  }

  async listErrors(
    query: DebugEventLogQueryDto,
    userId: string,
  ): Promise<DebugErrorGroupListResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const events = await this.getEventsForRange(workspaceId, query);
    const grouped = new Map<string, EventEntity[]>();

    for (const event of events.filter((item) => deriveIssues([item]).length)) {
      const payload = getPayload(event);
      const fingerprint = createFailureSignature({
        eventType: event.eventType,
        label: event.label,
        model: getPayloadString(payload, 'model'),
        toolName: getPayloadString(payload, 'toolName'),
        error: payload.error,
        payload,
      });
      grouped.set(fingerprint, [...(grouped.get(fingerprint) ?? []), event]);
    }

    const errors = Array.from(grouped.entries())
      .map(([fingerprint, groupedEvents]) => {
        const sorted = [...groupedEvents].sort(
          (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
        );
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const issue = deriveIssues([first])[0];
        const payload = getPayload(first);

        return {
          fingerprint,
          title: first.label,
          errorType: issue?.type ?? first.eventType,
          severity: computeSeverity(first),
          occurrenceCount: groupedEvents.length,
          affectedSessions: new Set(
            groupedEvents.map((event) => event.session?.id ?? ''),
          ).size,
          affectedAgents: Array.from(
            new Set(
              groupedEvents.map(
                (event) => event.session?.agent?.name ?? 'Unknown Agent',
              ),
            ),
          ),
          firstSeenAt: first.timestamp.toISOString(),
          lastSeenAt: last.timestamp.toISOString(),
          representativeEventId: first.id,
          representativeSessionId: first.session?.id ?? '',
          representativeMessage: issue?.reason ?? toDebugString(payload.error),
          relatedTool: getPayloadString(payload, 'toolName'),
          relatedModel: getPayloadString(payload, 'model'),
          status: 'open' as const,
        };
      })
      .sort((left, right) => {
        if (right.severity !== left.severity) {
          return (
            getDebugSeverityRank(right.severity) -
            getDebugSeverityRank(left.severity)
          );
        }
        return right.occurrenceCount - left.occurrenceCount;
      });

    const limit = normalizeDebugLimit(query.limit);
    return {
      errors: errors.slice(0, limit),
      page: {
        hasMore: errors.length > limit,
        total: errors.length,
      },
    };
  }

  async getTimeline(
    sessionId: string,
    query: DebugTimelineQueryDto,
    userId: string,
  ): Promise<DebugTimelineResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const session = await this.findSessionOrThrow(workspaceId, sessionId);
    const events = await this.getSessionEvents(workspaceId, sessionId);
    const eventBySpanId = new Map<string, EventEntity>();

    for (const event of events) {
      const spanId = getSpanId(event);
      if (spanId && !eventBySpanId.has(spanId)) {
        eventBySpanId.set(spanId, event);
      }
    }

    return {
      session: toDebugSessionSummary({
        ...session,
        events,
      } as SessionEntity),
      nodes: events.map((event) =>
        toDebugTimelineNode(
          event,
          eventBySpanId,
          query.includePayload && canExposeRawDebugPayloads(),
        ),
      ),
      criticalPath: calculateCriticalPath(events),
      criticalPathMethod: 'MAX_ACCUMULATED_LATENCY',
    };
  }

  async getRootCause(
    sessionId: string,
    query: DebugTimelineQueryDto,
    userId: string,
  ): Promise<DebugRootCauseResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    await this.findSessionOrThrow(workspaceId, sessionId);
    const events = await this.getSessionEvents(workspaceId, sessionId);
    const issues = deriveIssues(events);
    const candidates = issues.slice(0, 5).map((issue, index) => ({
      id: `candidate-${index + 1}`,
      title: issue.type.replace(/_/g, ' ').toLowerCase(),
      category: toDebugRootCauseCategory(issue.type),
      confidence: Math.max(0.4, 0.9 - index * 0.1),
      severity: issue.severity,
      explanation: issue.reason,
      firstBadEventId: issue.eventId,
      evidence: [
        {
          eventId: issue.eventId,
          eventType: issue.eventType as DebugEventLogItemDto['eventType'],
          label: issue.label,
          timestamp: issue.timestamp.toISOString(),
          summary: issue.reason,
          weight: Math.max(0.4, 1 - index * 0.1),
        },
      ],
    }));
    const primary = candidates[0];

    return {
      sessionId,
      summary:
        primary?.explanation ??
        'No deterministic issue candidate was found for this session.',
      candidates,
      primaryCandidateId: primary?.id,
      confidence: primary?.confidence,
      analysisMethod: 'HEURISTIC_V1',
      recommendedActions: candidates.slice(0, 3).map((candidate) => ({
        title: `Review ${candidate.category.toLowerCase()} evidence`,
        description: candidate.explanation,
        target:
          candidate.category === 'POLICY'
            ? 'POLICY'
            : candidate.category === 'TOOL'
              ? 'TOOL'
              : candidate.category === 'CONTEXT' ||
                  candidate.category === 'MEMORY'
                ? 'DATA'
                : 'CODE',
        priority:
          candidate.severity === 'CRITICAL'
            ? 'HIGH'
            : candidate.severity === 'WARNING'
              ? 'MEDIUM'
              : 'LOW',
      })),
    };
  }

  async getMemory(
    sessionId: string,
    query: DebugTimelineQueryDto,
    userId: string,
  ): Promise<DebugMemoryResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    await this.findSessionOrThrow(workspaceId, sessionId);
    const events = (await this.getSessionEvents(workspaceId, sessionId)).filter(
      (event) => event.eventType === 'MEMORY_ACCESS',
    );

    let hitCount = 0;
    let missCount = 0;
    let staleCount = 0;
    let unknownCount = 0;

    const accesses = events.map((event) => {
      const payload = getPayload(event);
      if (payload.hit === true) hitCount += 1;
      else if (payload.hit === false) missCount += 1;
      else unknownCount += 1;
      if (payload.stale === true) staleCount += 1;

      return {
        eventId: event.id,
        sessionId,
        operation: getPayloadString(payload, 'operation') ?? event.label,
        key: getPayloadString(payload, 'key'),
        hit: getPayloadBoolean(payload, 'hit'),
        stale: getPayloadBoolean(payload, 'stale'),
        timestamp: event.timestamp.toISOString(),
        summary: createPreview(payload.data ?? payload.value ?? payload),
      };
    });

    return {
      accesses,
      hitCount,
      missCount,
      staleMemoryCount: staleCount,
      memoryMissCount: missCount,
      unknownCount,
    };
  }

  async getPatterns(
    query: DebugAnalysisQueryDto,
    userId: string,
  ): Promise<DebugFailurePatternResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const events = await this.getEventsForRange(workspaceId, query);
    const issueEvents = events.filter((event) => deriveIssues([event]).length);
    const grouped = new Map<string, EventEntity[]>();

    for (const event of issueEvents) {
      const payload = getPayload(event);
      const signature = createFailureSignature({
        eventType: event.eventType,
        label: event.label,
        model: getPayloadString(payload, 'model'),
        toolName: getPayloadString(payload, 'toolName'),
      });
      grouped.set(signature, [...(grouped.get(signature) ?? []), event]);
    }

    return {
      patterns: Array.from(grouped.entries())
        .map(([signature, groupedEvents]) => {
          const first = groupedEvents[0];
          const last = groupedEvents[groupedEvents.length - 1];
          const affectedAgents = new Set(
            groupedEvents.map(
              (event) => event.session?.agent?.name ?? 'unknown',
            ),
          );

          return {
            id: signature,
            name: first.label,
            severity: computeSeverity(first),
            occurrenceCount: groupedEvents.length,
            affectedAgents: Array.from(affectedAgents),
            firstSeenAt: first.timestamp.toISOString(),
            lastSeenAt: last.timestamp.toISOString(),
            signature: {
              eventTypes: [
                first.eventType as DebugFailurePatternResponseDto['patterns'][number]['signature']['eventTypes'][number],
              ],
              labels: [first.label],
              model: getPayloadString(getPayload(first), 'model'),
              toolName: getPayloadString(getPayload(first), 'toolName'),
            },
            signatureVersion: 'SIGNATURE_V1' as const,
            exampleSessionId: first.session?.id ?? '',
          };
        })
        .sort((left, right) => right.occurrenceCount - left.occurrenceCount),
    };
  }

  async getBottlenecks(
    query: DebugAnalysisQueryDto,
    userId: string,
  ): Promise<DebugBottleneckResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const events = await this.getEventsForRange(workspaceId, query);
    const grouped = new Map<string, EventEntity[]>();

    for (const event of events) {
      const payload = getPayload(event);
      const label =
        getPayloadString(payload, 'toolName') ??
        getPayloadString(payload, 'model') ??
        getPayloadString(payload, 'operation') ??
        event.label;
      const key = `${toDebugBottleneckType(event)}:${label}`;
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }

    return {
      bottlenecks: Array.from(grouped.entries())
        .map(([key, groupedEvents]) => {
          const latencies = groupedEvents.map(
            (event) =>
              event.latency ?? getPayloadNumber(getPayload(event), 'latency'),
          );
          const [type, label] = key.split(':', 2);

          return {
            id: key,
            type: type as DebugBottleneckResponseDto['bottlenecks'][number]['type'],
            label,
            count: groupedEvents.length,
            avgLatency: average(latencies),
            p95Latency: percentile(latencies, 0.95) ?? 0,
            totalCost: groupedEvents.reduce(
              (sum, event) => sum + Number(event.cost ?? 0),
              0,
            ),
            affectedSessions: new Set(
              groupedEvents.map((event) => event.session?.id ?? ''),
            ).size,
            trend: 'flat' as const,
          };
        })
        .sort((left, right) => right.p95Latency - left.p95Latency),
    };
  }

  async getLatency(
    query: DebugAnalysisQueryDto,
    userId: string,
  ): Promise<DebugLatencyResponseDto> {
    const workspaceId = query.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    const events = await this.getEventsForRange(workspaceId, query);
    const latencies = events.map(
      (event) =>
        event.latency ?? getPayloadNumber(getPayload(event), 'latency'),
    );

    return {
      summary: {
        avgLatency: average(latencies),
        p50: percentile(latencies, 0.5) ?? 0,
        p95: percentile(latencies, 0.95) ?? 0,
        p99:
          latencies.filter((value) => typeof value === 'number').length >= 5
            ? percentile(latencies, 0.99)
            : null,
        slowEventCount: latencies.filter(
          (value): value is number =>
            typeof value === 'number' && value >= 3000,
        ).length,
      },
      buckets: toDebugLatencyBuckets(events),
    };
  }

  async reproduce(
    sessionId: string,
    body: DebugReproduceRequestDto,
    userId: string,
  ): Promise<DebugReproduceResponseDto> {
    const workspaceId = body.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    await this.findSessionOrThrow(workspaceId, sessionId);
    const events = await this.getSessionEvents(workspaceId, sessionId);

    const steps = events.map((event, index) => {
      const payload = getPayload(event);
      const replayable = isDebugReplayable(event.eventType, payload);

      return {
        sourceEventId: event.id,
        eventType:
          event.eventType as DebugReproduceResponseDto['steps'][number]['eventType'],
        label: event.label,
        status: replayable ? ('MATCHED' as const) : ('SKIPPED' as const),
        order: index + 1,
        replayable,
        reason: replayable
          ? undefined
          : 'Side-effecting or environment-dependent event.',
        expectedPreview: createPreview(payload.output ?? payload.result),
        actualPreview: undefined,
        diffSummary: undefined,
      };
    });
    const replayableCount = steps.filter((step) => step.replayable).length;

    return {
      replayId: `dry-run-${sessionId}`,
      sourceSessionId: sessionId,
      mode: body.mode ?? 'DRY_RUN',
      status: body.mode && body.mode !== 'DRY_RUN' ? 'DRY_RUN_ONLY' : 'READY',
      reproducible: replayableCount > 0,
      limitations: [
        'External tool responses are not re-executed.',
        'Environment variables and external service state are not captured.',
        'This endpoint creates a deterministic replay plan only.',
      ],
      deterministicScore:
        steps.length === 0
          ? 0
          : Number((replayableCount / steps.length).toFixed(2)),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      steps,
      replayPackage: this.createReproducePackage(sessionId, events),
      summary: `${replayableCount}/${steps.length} events are replay-plan compatible.`,
    };
  }

  private createReproducePackage(sessionId: string, events: EventEntity[]) {
    const firstPayload = getPayload(events[0]);
    const userInputEvent =
      events.find((event) => event.eventType === 'USER_INPUT') ?? events[0];
    const userInputPayload = getPayload(userInputEvent);
    const llmEvents = events.filter((event) => event.eventType.includes('LLM'));
    const toolEvents = events.filter((event) =>
      event.eventType.includes('TOOL'),
    );
    const contextEvents = events.filter((event) => {
      const type = event.eventType;
      return (
        type.includes('CONTEXT') ||
        type.includes('MEMORY') ||
        type.includes('RETRIEVER')
      );
    });

    return {
      userInput: toDebugString(userInputPayload.input ?? userInputPayload.text),
      promptVersion:
        getPayloadString(firstPayload, 'promptVersion') ??
        findFirstPayloadString(events, 'promptVersion'),
      agentVersion:
        getPayloadString(firstPayload, 'agentVersion') ??
        findFirstPayloadString(events, 'agentVersion'),
      policyVersion:
        getPayloadString(firstPayload, 'policyVersion') ??
        findFirstPayloadString(events, 'policyVersion'),
      sdkVersion:
        getPayloadString(firstPayload, 'sdkVersion') ??
        findFirstPayloadString(events, 'sdkVersion'),
      environment:
        getPayloadString(firstPayload, 'environment') ??
        findFirstPayloadString(events, 'environment'),
      modelSettings: llmEvents.map((event) => {
        const payload = getPayload(event);
        return {
          eventId: event.id,
          provider: getPayloadString(payload, 'provider'),
          model: getPayloadString(payload, 'model') ?? event.label,
          temperature: getPayloadNumber(payload, 'temperature'),
          maxTokens: getPayloadNumber(payload, 'maxTokens'),
          requestPreview: createPreview(payload.messages ?? payload.input),
        };
      }),
      toolCalls: toolEvents.map((event) => {
        const payload = getPayload(event);
        return {
          eventId: event.id,
          toolName:
            getPayloadString(payload, 'toolName') ??
            getPayloadString(payload, 'name') ??
            event.label,
          argumentsPreview: createPreview(payload.args ?? payload.arguments),
          sideEffect: getPayloadBoolean(payload, 'sideEffect') ?? false,
          riskCategory: toDebugRiskCategory(payload),
        };
      }),
      contextSnapshots: contextEvents.map((event) => ({
        eventId: event.id,
        label: event.label,
        preview: createPreview(getPayload(event)),
      })),
      auditTrail: [
        { label: 'sourceSessionId', value: sessionId },
        {
          label: 'eventCount',
          value: String(events.length),
        },
        {
          label: 'capturedAt',
          value: new Date().toISOString(),
        },
      ],
    };
  }

  async simulatePolicy(
    sessionId: string,
    body: DebugPolicySimulationRequestDto,
    userId: string,
  ): Promise<DebugPolicySimulationResponseDto> {
    const workspaceId = body.workspaceId;
    await this.workspaceAccess.assertAccess(userId, workspaceId);
    await this.findSessionOrThrow(workspaceId, sessionId);
    const events = await this.getSessionEvents(workspaceId, sessionId);
    const policyEvents = events.filter((event) => {
      const payload = getPayload(event);
      return (
        event.eventType === 'POLICY_EVALUATION' &&
        (!body.toolName ||
          getPayloadString(payload, 'toolName') === body.toolName)
      );
    });

    const matchedPolicies = policyEvents.map((event) => {
      const payload = getPayload(event);
      const result = normalizeDebugPolicyResult(payload.action, payload.allow);
      return {
        policyId: getPayloadString(payload, 'policyId') ?? event.id,
        name: getPayloadString(payload, 'policyName'),
        version: getPayloadString(payload, 'policyVersion'),
        result,
        reason: toDebugString(payload.reason),
        severity:
          getPayloadRiskLevel(payload, 'severity') ??
          getPayloadRiskLevel(payload, 'riskLevel'),
      };
    });
    const result = matchedPolicies.some((policy) => policy.result === 'BLOCK')
      ? 'BLOCK'
      : matchedPolicies.some((policy) => policy.result === 'WARN')
        ? 'WARN'
        : 'ALLOW';

    return {
      allow: result !== 'BLOCK',
      toolName: body.toolName,
      result,
      source: matchedPolicies.length > 0 ? 'RECORDED_POLICY_EVENT' : 'NO_MATCH',
      actuallyEvaluated: false,
      matchedPolicies,
    };
  }

  private async findSessionOrThrow(
    workspaceId: string,
    sessionId: string,
  ): Promise<SessionEntity> {
    const session = await this.dataSource
      .getRepository(SessionEntity)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.workspaceId = :workspaceId', { workspaceId })
      .getOne();

    if (!session) {
      throw new NotFoundException({ message: 'Session not found.' });
    }
    return session;
  }

  private async getSessionEvents(
    workspaceId: string,
    sessionId: string,
  ): Promise<EventEntity[]> {
    const events = await this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.session', 'session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.id = :sessionId', { sessionId })
      .andWhere('session.workspaceId = :workspaceId', { workspaceId })
      .orderBy('event.timestamp', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .take(MAX_SESSION_EVENTS + 1)
      .getMany();

    if (events.length > MAX_SESSION_EVENTS) {
      throw new BadRequestException({
        message:
          'This session has too many events for an interactive debug view. Narrow the session or use an export workflow.',
      });
    }

    return events;
  }

  private async getEventsForRange(
    workspaceId: string,
    query: DebugSearchQueryDto,
  ): Promise<EventEntity[]> {
    const { from, to } = getDebugDateRange(query, 24);
    const qb = this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.session', 'session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .andWhere('event.timestamp >= :from', { from })
      .andWhere('event.timestamp <= :to', { to })
      .orderBy('event.timestamp', 'ASC')
      .addOrderBy('event.id', 'ASC');

    this.applySearchFilters(qb, query);
    if ('errorsOnly' in query && query.errorsOnly) {
      qb.andWhere(
        '(event.eventType = :errorType OR event.payload ? :errorKey)',
        {
          errorType: 'ERROR',
          errorKey: 'error',
        },
      );
    }
    const events = await qb.take(MAX_ANALYSIS_EVENTS + 1).getMany();

    if (events.length > MAX_ANALYSIS_EVENTS) {
      throw new BadRequestException({
        message:
          'Debug analysis matched too many events. Narrow the time range or filter by agent/session.',
      });
    }

    return events;
  }

  private async getPagedEvents(
    workspaceId: string,
    query: DebugEventLogQueryDto,
    extend?: (qb: SelectQueryBuilder<EventEntity>) => void,
  ): Promise<{ items: EventEntity[]; page: DebugPageInfoDto }> {
    const { from, to } = getDebugDateRange(query, 24);
    const limit = normalizeDebugLimit(query.limit);
    const cursor = decodeDebugCursor(query.cursor);
    const qb = this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.session', 'session')
      .leftJoinAndSelect('session.agent', 'agent')
      .where('session.workspaceId = :workspaceId', { workspaceId })
      .andWhere('event.timestamp >= :from', { from })
      .andWhere('event.timestamp <= :to', { to })
      .orderBy('event.timestamp', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(limit + 1);

    this.applySearchFilters(qb, query);
    if (query.eventType) {
      qb.andWhere('event.eventType = :eventType', {
        eventType: query.eventType,
      });
    }
    if (query.label) {
      qb.andWhere('event.label ILIKE :label', { label: `%${query.label}%` });
    }
    if (query.errorsOnly) {
      qb.andWhere(
        '(event.eventType = :errorType OR event.payload ? :errorKey)',
        {
          errorType: 'ERROR',
          errorKey: 'error',
        },
      );
    }
    if (query.phase) {
      qb.andWhere("event.payload->>'phase' = :phase", { phase: query.phase });
    }
    if (cursor) {
      qb.andWhere(
        '(event.timestamp < :cursorTimestamp OR (event.timestamp = :cursorTimestamp AND event.id < :cursorId))',
        {
          cursorTimestamp: new Date(cursor.timestamp),
          cursorId: cursor.id,
        },
      );
    }
    extend?.(qb);

    const events = await qb.getMany();
    const visible = events.slice(0, limit).filter((event) => {
      if (query.severity && computeSeverity(event) !== query.severity) {
        return false;
      }
      return true;
    });

    return {
      items: visible,
      page: createDebugPageInfo(events, limit, (event) =>
        encodeDebugCursor(event.timestamp, event.id),
      ),
    };
  }

  private applySearchFilters(
    qb: SelectQueryBuilder<EventEntity>,
    query: DebugSearchQueryDto,
  ) {
    if (query.agentId) {
      qb.andWhere('session.agentId = :agentId', { agentId: query.agentId });
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
  }
}
