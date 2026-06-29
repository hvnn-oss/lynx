import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AgentEntity,
  EventEntity,
  SessionEntity,
  WorkspaceApiKeyEntity,
  WorkspacePlanEntity,
  WorkspaceEntity,
} from '@repo/database';
import {
  ERROR_CODES,
  SESSION_STATUS,
  type SessionStatus,
} from '@repo/constants';
import { LynxEventDto } from '@repo/dto';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

interface IngestContext {
  workspace: WorkspaceEntity;
  retentionDays: number;
  agentsByKey: Map<string, AgentEntity>;
  sessionsByKey: Map<string, SessionEntity>;
}

const fallbackPlanRetentionDays: Record<string, number> = {
  FREE: 3,
  PRO: 30,
  ENTERPRISE: 365,
};

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly maxBatchSize: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.maxBatchSize =
      this.configService.get<number>('MAX_INGEST_BATCH_SIZE') ?? 100;
  }

  async ingestEvent(dto: LynxEventDto, apiKey?: string) {
    const context = await this.createIngestContext(apiKey);
    return await this.ingestEventWithContext(dto, context);
  }

  async ingestEvents(dtos: LynxEventDto[], apiKey?: string) {
    if (dtos.length === 0) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Batch must contain at least one event.',
      });
    }
    if (dtos.length > this.maxBatchSize) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: `Batch size exceeds maximum of ${this.maxBatchSize} events.`,
      });
    }

    const context = await this.createIngestContext(apiKey);
    const results: Array<{
      success: boolean;
      runId: string;
      eventType?: string;
      label?: string;
      result?: unknown;
      reason?: string;
    }> = [];

    for (const dto of dtos) {
      try {
        const res = await this.ingestEventWithContext(dto, context);
        results.push({
          success: res.success !== false,
          runId: dto.runId,
          eventType: dto.eventType,
          label: dto.label,
          result: res,
        });
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.error(
          `Failed to ingest event inside batch runId=${dto.runId}: ${error.message}`,
          error.stack,
        );
        results.push({
          success: false,
          runId: dto.runId,
          reason: error.message,
        });
      }
    }

    const success = results.every((item) => item.success === true);
    return { success, count: results.length, details: results };
  }

  private async createIngestContext(apiKey?: string): Promise<IngestContext> {
    if (!apiKey) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'API key is required.',
      });
    }

    const keyHash = this.hashApiKey(apiKey);
    const workspaceApiKey = await this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder('apiKey')
      .innerJoinAndSelect('apiKey.workspace', 'workspace')
      .leftJoinAndSelect('workspace.planConfig', 'planConfig')
      .where('apiKey.keyHash = :keyHash', { keyHash })
      .andWhere('apiKey.revokedAt IS NULL')
      .andWhere('(apiKey.expiresAt IS NULL OR apiKey.expiresAt > :now)', {
        now: new Date(),
      })
      .getOne();

    let workspace = workspaceApiKey?.workspace;

    if (!workspace) {
      workspace = await this.dataSource.getRepository(WorkspaceEntity).findOne({
        where: { apiKey },
        relations: { planConfig: true },
      });
    }

    if (!workspace) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Invalid API key.',
      });
    }

    if (workspaceApiKey && !workspaceApiKey.scopes.includes('events:write')) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'API key does not have events:write scope.',
      });
    }

    if (workspaceApiKey) {
      await this.dataSource
        .getRepository(WorkspaceApiKeyEntity)
        .update(workspaceApiKey.id, { lastUsedAt: new Date() });
    }

    return {
      workspace,
      retentionDays: this.getRetentionDays(workspace),
      agentsByKey: new Map(),
      sessionsByKey: new Map(),
    };
  }

  private async ingestEventWithContext(
    dto: LynxEventDto,
    context: IngestContext,
  ) {
    const {
      workspaceId,
      eventId,
      clientId,
      agentId,
      sessionId,
      eventType,
      label,
      payload,
      timestamp,
      agentName,
      runId,
    } = dto;
    const workspace = context.workspace;

    if (
      workspaceId &&
      workspaceId !== workspace.id &&
      workspaceId !== workspace.name
    ) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Workspace does not match API key.',
      });
    }

    const eventDate = this.validateEventTimestamp(timestamp);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - context.retentionDays);

    if (eventDate < limitDate) {
      this.logger.warn(
        `Event skipped: timestamp is older than retention limit (${context.retentionDays} days) for workspace ${workspace.id}`,
      );
      return {
        success: false,
        reason: `Event skipped due to retention limit (${context.retentionDays} days).`,
      };
    }

    const agent = await this.findOrCreateAgent(
      context,
      workspace,
      agentId,
      agentName,
    );
    const session = await this.findOrCreateSession(
      context,
      workspace,
      agent,
      runId,
      sessionId,
      eventDate,
    );
    const { cost, promptTokens, completionTokens, totalTokens } =
      this.processPayloadCost(label, payload);
    let shouldSaveSession = false;

    if (payload && (totalTokens > 0 || cost > 0)) {
      session.totalPromptTokens += promptTokens;
      session.totalCompletionTokens += completionTokens;
      session.totalTokens += totalTokens;
      session.totalCost += cost;
      shouldSaveSession = true;
    }
    if (this.applySessionOutcome(session, eventType, payload, eventDate)) {
      shouldSaveSession = true;
    }
    if (shouldSaveSession) {
      await this.dataSource.getRepository(SessionEntity).save(session);
    }

    if (eventId) {
      const existingEvent = await this.dataSource
        .getRepository(EventEntity)
        .createQueryBuilder('event')
        .innerJoin('event.session', 'session')
        .where('event.clientId = :clientId', { clientId })
        .andWhere('event.clientEventId = :eventId', { eventId })
        .andWhere('session.workspaceId = :workspaceId', {
          workspaceId: workspace.id,
        })
        .getOne();

      if (existingEvent) {
        return { success: true, duplicate: true };
      }
    }

    const event = this.dataSource.getRepository(EventEntity).create({
      clientId,
      clientEventId: eventId,
      schemaVersion: dto.schemaVersion,
      eventType,
      label,
      payload,
      latency: payload?.latency,
      cost: payload?.cost !== undefined ? Number(payload?.cost) : cost,
      timestamp: eventDate,
      session,
    });

    try {
      await this.dataSource.getRepository(EventEntity).save(event);
    } catch (error) {
      if (this.isDuplicateEventError(error)) {
        return { success: true, duplicate: true };
      }
      throw error;
    }
    return { success: true };
  }

  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private isDuplicateEventError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }

  private async findOrCreateAgent(
    context: IngestContext,
    workspace: WorkspaceEntity,
    agentId?: string,
    agentName?: string,
  ) {
    const agentRepository = this.dataSource.getRepository(AgentEntity);
    const cacheKey = agentId || agentName || 'default';
    const cached = context.agentsByKey.get(cacheKey);
    if (cached) return cached;

    let agent = agentId
      ? await agentRepository.findOne({
          where: { id: agentId, workspace: { id: workspace.id } },
        })
      : null;
    if (!agent && agentId) {
      agent = await agentRepository.findOne({
        where: { name: agentId, workspace: { id: workspace.id } },
      });
    }
    if (!agent) {
      agent = agentRepository.create({
        id: agentId && agentId.length === 36 ? agentId : undefined,
        name: agentName || agentId || 'Default Agent',
        defaultModel: 'gpt-4o',
        workspace,
      });
      await agentRepository.save(agent);
    }

    context.agentsByKey.set(cacheKey, agent);
    context.agentsByKey.set(agent.id, agent);
    context.agentsByKey.set(agent.name, agent);
    return agent;
  }

  private async findOrCreateSession(
    context: IngestContext,
    workspace: WorkspaceEntity,
    agent: AgentEntity,
    runId: string,
    sessionId: string | undefined,
    eventDate: Date,
  ) {
    const sessionRepository = this.dataSource.getRepository(SessionEntity);
    const sessionKey = sessionId || runId;
    const cacheKey = sessionKey || 'default';
    const cached = context.sessionsByKey.get(cacheKey);
    if (cached) return cached;

    let session = sessionId
      ? await sessionRepository.findOne({
          where: { id: sessionId, workspace: { id: workspace.id } },
        })
      : null;
    if (!session && sessionKey) {
      session = await sessionRepository.findOne({
        where: [
          { id: sessionKey, workspace: { id: workspace.id } },
          { name: sessionKey, workspace: { id: workspace.id } },
          { name: runId, workspace: { id: workspace.id } },
        ],
      });
    }
    if (!session) {
      session = sessionRepository.create({
        id: sessionId && sessionId.length === 36 ? sessionId : undefined,
        name: runId,
        startedAt: eventDate,
        status: SESSION_STATUS.RUNNING,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        workspace,
        agent,
      });
      await sessionRepository.save(session);
    }

    context.sessionsByKey.set(cacheKey, session);
    context.sessionsByKey.set(runId, session);
    if (sessionId) {
      context.sessionsByKey.set(sessionId, session);
    }
    context.sessionsByKey.set(session.id, session);
    context.sessionsByKey.set(session.name, session);
    return session;
  }

  private applySessionOutcome(
    session: SessionEntity,
    eventType: string,
    payload: Record<string, any> | undefined,
    eventDate: Date,
  ): boolean {
    if (eventType !== 'SESSION_OUTCOME') return false;

    const status = this.normalizeSessionStatus(payload?.status);
    session.status = status;
    session.endedAt = this.resolveOutcomeEndDate(payload, eventDate);
    return true;
  }

  private normalizeSessionStatus(status: unknown): SessionStatus {
    if (status === SESSION_STATUS.COMPLETED) return SESSION_STATUS.COMPLETED;
    if (status === SESSION_STATUS.CANCELLED) return SESSION_STATUS.CANCELLED;
    return SESSION_STATUS.FAILED;
  }

  private resolveOutcomeEndDate(
    payload: Record<string, any> | undefined,
    fallback: Date,
  ): Date {
    const value = payload?.endedAt ?? payload?.completedAt;
    if (typeof value !== 'string' && typeof value !== 'number') {
      return fallback;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  private processPayloadCost(label: string, payload?: Record<string, any>) {
    let cost = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    if (!payload) {
      return { cost, promptTokens, completionTokens, totalTokens };
    }

    const usage = payload.usage as Record<string, any> | undefined;
    if (usage) {
      promptTokens = Number(usage.promptTokens ?? 0);
      completionTokens = Number(usage.completionTokens ?? 0);
      totalTokens = Number(
        usage.totalTokens ?? promptTokens + completionTokens,
      );
      const modelName = (payload.model as string) || label || 'gpt-4o';
      cost = this.estimateLlmCost(modelName, promptTokens, completionTokens);
      if (payload.cost === undefined) {
        payload.cost = cost;
      }
    }

    if (payload.cost !== undefined) {
      cost = Number(payload.cost);
    }

    return { cost, promptTokens, completionTokens, totalTokens };
  }

  private getRetentionDays(workspace: WorkspaceEntity): number {
    return (
      workspace.planConfig?.retentionDays ??
      fallbackPlanRetentionDays[workspace.plan] ??
      fallbackPlanRetentionDays.FREE
    );
  }

  private validateEventTimestamp(timestamp?: number): Date {
    const eventDate = new Date(timestamp || Date.now());
    if (Number.isNaN(eventDate.getTime())) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Invalid event timestamp.',
      });
    }

    const maxFutureSkewMs =
      (this.configService.get<number>('MAX_EVENT_FUTURE_SKEW_SECONDS') ?? 300) *
      1000;
    if (eventDate.getTime() - Date.now() > maxFutureSkewMs) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Event timestamp is too far in the future.',
      });
    }

    return eventDate;
  }

  private estimateLlmCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const modelLower = model.toLowerCase();
    let inputRate = 1.0;
    let outputRate = 2.0;

    if (modelLower.includes('gpt-4o')) {
      inputRate = 2.5;
      outputRate = 10.0;
    } else if (modelLower.includes('gpt-4')) {
      inputRate = 30.0;
      outputRate = 60.0;
    } else if (modelLower.includes('gpt-3.5')) {
      inputRate = 0.5;
      outputRate = 1.5;
    } else if (
      modelLower.includes('claude-3-5-sonnet') ||
      modelLower.includes('sonnet')
    ) {
      inputRate = 3.0;
      outputRate = 15.0;
    } else if (
      modelLower.includes('claude-3-opus') ||
      modelLower.includes('opus')
    ) {
      inputRate = 15.0;
      outputRate = 75.0;
    } else if (modelLower.includes('gemini')) {
      inputRate = 0.075;
      outputRate = 0.3;
    }

    return (
      (promptTokens * inputRate + completionTokens * outputRate) / 1_000_000
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanExpiredEvents() {
    this.logger.log('Starting daily expired event cleanup...');

    const plans = await this.dataSource
      .getRepository(WorkspacePlanEntity)
      .find({ where: { isActive: true } });

    const effectivePlans =
      plans.length > 0
        ? plans
        : Object.entries(fallbackPlanRetentionDays).map(
            ([code, retentionDays]) => ({ code, retentionDays }),
          );

    for (const plan of effectivePlans) {
      await this.deleteExpiredEventsForPlan(plan.code, plan.retentionDays);
    }
  }

  private async deleteExpiredEventsForPlan(
    plan: string,
    retentionDays: number,
  ) {
    const limit = new Date();
    limit.setDate(limit.getDate() - retentionDays);

    const result = await this.dataSource
      .getRepository(EventEntity)
      .createQueryBuilder('event')
      .delete()
      .where('event.timestamp < :limit', { limit })
      .andWhere(() => {
        const subQuery = this.dataSource
          .createQueryBuilder()
          .subQuery()
          .select('s.id')
          .from(SessionEntity, 's')
          .innerJoin('s.workspace', 'w')
          .where('w.plan = :plan')
          .getQuery();
        return 'event.sessionId IN ' + subQuery;
      })
      .setParameter('plan', plan)
      .execute();

    this.logger.log(
      `Cleaned up ${result.affected ?? 0} expired events for ${plan} tier.`,
    );
  }
}
