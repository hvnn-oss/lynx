import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  EventEntity,
  SessionEntity,
  WorkspaceEntity,
  AgentEntity,
} from '@repo/database';
import { LynxEventDto } from '@repo/dto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  // 수신된 텔레메트리 이벤트를 보존 기간 검사 후 저장합니다.
  async ingestEvent(dto: LynxEventDto) {
    const {
      workspaceId,
      agentId,
      sessionId,
      eventType,
      label,
      payload,
      timestamp,
      agentName,
    } = dto;

    const workspaceRepository = this.dataSource.getRepository(WorkspaceEntity);
    const agentRepository = this.dataSource.getRepository(AgentEntity);
    const sessionRepository = this.dataSource.getRepository(SessionEntity);
    const eventRepository = this.dataSource.getRepository(EventEntity);

    // 1. 워크스페이스 조회
    let workspace = await workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace && workspaceId) {
      workspace = await workspaceRepository.findOne({
        where: { name: workspaceId },
      });
    }
    if (!workspace) {
      workspace = await workspaceRepository.findOne({ where: {} });
    }

    if (!workspace) {
      this.logger.error(
        'No workspace found in the database. Event ingestion skipped.',
      );
      return { success: false, reason: 'No workspace found.' };
    }

    // 2. 요금제별 보존 기간 검증
    const plan = workspace.plan || 'FREE';
    const retentionFree =
      this.configService.get<number>('RETENTION_DAYS_FREE') ?? 3;
    const retentionPro =
      this.configService.get<number>('RETENTION_DAYS_PRO') ?? 30;
    const retentionEnterprise =
      this.configService.get<number>('RETENTION_DAYS_ENTERPRISE') ?? 365;

    let retentionDays = retentionFree;
    if (plan === 'PRO') {
      retentionDays = retentionPro;
    } else if (plan === 'ENTERPRISE') {
      retentionDays = retentionEnterprise;
    }

    const eventDate = new Date(timestamp || Date.now());
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - retentionDays);

    if (eventDate < limitDate) {
      this.logger.warn(
        `Event skipped: timestamp is older than retention limit (${retentionDays} days) for plan ${plan}`,
      );
      return {
        success: false,
        reason: `Event skipped due to plan ${plan} retention limit (${retentionDays} days).`,
      };
    }

    // 3. 에이전트 조회/생성
    let agent = await agentRepository.findOne({
      where: { id: agentId },
    });
    if (!agent && agentId) {
      agent = await agentRepository.findOne({
        where: { name: agentId },
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

    // 4. 세션 조회/생성
    let session = await sessionRepository.findOne({
      where: { id: sessionId },
    });
    if (!session && sessionId) {
      session = await sessionRepository.findOne({
        where: [{ id: sessionId }, { name: sessionId }],
      });
    }
    if (!session) {
      session = sessionRepository.create({
        id: sessionId && sessionId.length === 36 ? sessionId : undefined,
        name: sessionId || 'Default Session',
        startedAt: new Date(timestamp || Date.now()),
        status: 'RUNNING',
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        workspace,
        agent,
      });
      await sessionRepository.save(session);
    }

    // 5. 이벤트 토큰 사용량 및 비용 갱신
    let calculatedCost = 0;
    if (payload) {
      const payloadObj = payload as Record<string, any>;
      const usage = payloadObj.usage as Record<string, any> | undefined;
      if (usage) {
        const promptTokens = (usage.promptTokens as number) ?? 0;
        const completionTokens = (usage.completionTokens as number) ?? 0;
        const totalTokens =
          (usage.totalTokens as number) ?? promptTokens + completionTokens;

        session.totalPromptTokens += promptTokens;
        session.totalCompletionTokens += completionTokens;
        session.totalTokens += totalTokens;

        const modelName = (payloadObj.model as string) || label || 'gpt-4o';
        calculatedCost = this.estimateLlmCost(
          modelName,
          promptTokens,
          completionTokens,
        );
        payloadObj.cost = calculatedCost;
      }

      const finalCost =
        payloadObj.cost !== undefined
          ? Number(payloadObj.cost)
          : calculatedCost;
      session.totalCost += finalCost;
      await sessionRepository.save(session);
    }

    // 6. 이벤트 저장
    const event = eventRepository.create({
      eventType,
      label,
      payload,
      latency: payload?.latency,
      cost:
        payload?.cost !== undefined ? Number(payload?.cost) : calculatedCost,
      timestamp: eventDate,
      session,
    });

    await eventRepository.save(event);
    return { success: true };
  }

  // 배치로 수신된 텔레메트리 이벤트들을 순차적으로 처리합니다.
  async ingestEvents(dtos: LynxEventDto[]) {
    const results: any[] = [];
    for (const dto of dtos) {
      try {
        const res = await this.ingestEvent(dto);
        results.push({
          success: true,
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
    return { success: true, count: results.length, details: results };
  }

  private estimateLlmCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const modelLower = model.toLowerCase();
    let inputRate = 1.0; // per 1M tokens
    let outputRate = 2.0; // per 1M tokens

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

  // 매일 자정에 보존 기간이 만료된 이벤트를 삭제합니다.
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanExpiredEvents() {
    this.logger.log('Starting daily expired event cleanup...');
    const retentionFree =
      this.configService.get<number>('RETENTION_DAYS_FREE') ?? 3;
    const retentionPro =
      this.configService.get<number>('RETENTION_DAYS_PRO') ?? 30;
    const retentionEnterprise =
      this.configService.get<number>('RETENTION_DAYS_ENTERPRISE') ?? 365;

    const eventRepository = this.dataSource.getRepository(EventEntity);

    // FREE 요금제 삭제
    const freeLimit = new Date();
    freeLimit.setDate(freeLimit.getDate() - retentionFree);
    const freeResult = await eventRepository
      .createQueryBuilder('event')
      .delete()
      .where('event.timestamp < :freeLimit', { freeLimit })
      .andWhere(
        'event.sessionId IN (SELECT s.id FROM session s INNER JOIN workspace w ON s.workspaceId = w.id WHERE w.plan = :freePlan)',
        { freePlan: 'FREE' },
      )
      .execute();
    this.logger.log(
      `Cleaned up ${freeResult.affected ?? 0} expired events for FREE tier.`,
    );

    // PRO 요금제 삭제
    const proLimit = new Date();
    proLimit.setDate(proLimit.getDate() - retentionPro);
    const proResult = await eventRepository
      .createQueryBuilder('event')
      .delete()
      .where('event.timestamp < :proLimit', { proLimit })
      .andWhere(
        'event.sessionId IN (SELECT s.id FROM session s INNER JOIN workspace w ON s.workspaceId = w.id WHERE w.plan = :proPlan)',
        { proPlan: 'PRO' },
      )
      .execute();
    this.logger.log(
      `Cleaned up ${proResult.affected ?? 0} expired events for PRO tier.`,
    );

    // ENTERPRISE 요금제 삭제
    const entLimit = new Date();
    entLimit.setDate(entLimit.getDate() - retentionEnterprise);
    const entResult = await eventRepository
      .createQueryBuilder('event')
      .delete()
      .where('event.timestamp < :entLimit', { entLimit })
      .andWhere(
        'event.sessionId IN (SELECT s.id FROM session s INNER JOIN workspace w ON s.workspaceId = w.id WHERE w.plan = :entPlan)',
        { entPlan: 'ENTERPRISE' },
      )
      .execute();
    this.logger.log(
      `Cleaned up ${entResult.affected ?? 0} expired events for ENTERPRISE tier.`,
    );
  }
}
