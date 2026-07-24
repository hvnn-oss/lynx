import {
  AgentEntity,
  EventEntity,
  RunEntity,
  SessionEntity,
} from "@repo/database";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import type { IngestEvent } from "./event.schema.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** SDK 이벤트와 연결된 Agent, Session, Event 저장 작업을 담당합니다. */
export class OpenAPIEventRepository {
  /** 워크스페이스와 클라이언트 범위에서 이미 저장된 이벤트를 찾습니다. */
  async findEvent(workspaceId: string, clientId: string, eventId: string) {
    return AppDataSource.getRepository(EventEntity)
      .createQueryBuilder("event")
      .innerJoin("event.run", "run")
      .where("run.workspaceId = :workspaceId", { workspaceId })
      .andWhere("event.clientId = :clientId", { clientId })
      .andWhere("event.clientEventId = :eventId", { eventId })
      .getOne();
  }

  /** 이벤트의 agentId 또는 이름으로 Agent를 찾고 없으면 생성합니다. */
  async findOrCreateAgent(workspaceId: string, event: IngestEvent) {
    const repository = AppDataSource.getRepository(AgentEntity);
    const clientAgentId = event.agentId ?? event.agentName;
    const agent = await repository.findOne({
      where:
        event.agentId && UUID_PATTERN.test(event.agentId)
          ? [
              { id: event.agentId, workspace: { id: workspaceId } },
              { clientAgentId, workspace: { id: workspaceId } },
            ]
          : { clientAgentId, workspace: { id: workspaceId } },
    });
    if (agent) return agent;
    return repository
      .save(
        repository.create({
          name: event.agentName,
          clientAgentId,
          defaultModel: String(event.payload.model ?? "unknown"),
          workspace: { id: workspaceId },
        }),
      )
      .catch(async (error: unknown) => {
        if (!this.isUniqueViolation(error)) throw error;
        return repository.findOneByOrFail({
          clientAgentId,
          workspace: { id: workspaceId },
        });
      });
  }

  /** SDK sessionId를 기준으로 Session을 찾고 없으면 실행 중 상태로 생성합니다. */
  async findOrCreateSession(
    workspaceId: string,
    event: IngestEvent,
    agent: AgentEntity,
  ) {
    const repository = AppDataSource.getRepository(SessionEntity);
    const externalId = event.sessionId ?? event.runId;
    const session = await repository.findOne({
      where: {
        clientId: event.clientId,
        clientSessionId: externalId,
        workspace: { id: workspaceId },
      },
    });
    if (session) return session;
    return repository
      .save(
        repository.create({
          name: externalId,
          clientId: event.clientId,
          clientSessionId: externalId,
          status: "RUNNING",
          startedAt: new Date(event.timestamp),
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          workspace: { id: workspaceId },
          agent,
        }),
      )
      .catch(async (error: unknown) => {
        if (!this.isUniqueViolation(error)) throw error;
        return repository.findOneByOrFail({
          clientId: event.clientId,
          clientSessionId: externalId,
          workspace: { id: workspaceId },
        });
      });
  }

  /** SDK runId로 Run을 찾고 없으면 해당 Session 아래에 생성합니다. */
  async findOrCreateRun(
    workspaceId: string,
    event: IngestEvent,
    session: SessionEntity,
    agent: AgentEntity,
  ) {
    const repository = AppDataSource.getRepository(RunEntity);
    const existing = await repository.findOneBy({
      workspaceId,
      clientId: event.clientId,
      clientRunId: event.runId,
    });
    if (existing) return existing;
    return repository
      .save(
        repository.create({
          workspaceId,
          clientId: event.clientId,
          clientRunId: event.runId,
          sessionId: session.id,
          agentId: agent.id,
          status: "RUNNING",
          startedAt: new Date(event.timestamp),
          endedAt: null,
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
        }),
      )
      .catch(async (error: unknown) => {
        if (!this.isUniqueViolation(error)) throw error;
        return repository.findOneByOrFail({
          workspaceId,
          clientId: event.clientId,
          clientRunId: event.runId,
        });
      });
  }

  /** Event 저장과 Run 집계 증가를 하나의 트랜잭션으로 처리합니다. */
  async saveEvent(session: SessionEntity, run: RunEntity, event: IngestEvent) {
    const usage = event.payload.usage as Record<string, unknown> | undefined;
    const latency = Number(event.payload.latency);
    const cost = Number(event.payload.cost);
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EventEntity);
      const saved = await repository.save(
        repository.create({
          eventType: event.eventType as EventEntity["eventType"],
          label: event.label,
          clientId: event.clientId,
          clientEventId: event.eventId,
          schemaVersion: event.schemaVersion,
          payload: {
            ...event.payload,
            runId: event.runId,
            sessionId: event.sessionId ?? session.name,
          },
          latency: Number.isFinite(latency) ? latency : undefined,
          cost: Number.isFinite(cost) ? cost : undefined,
          timestamp: new Date(event.timestamp),
          session,
          run,
        }),
      );

      const promptTokens = this.number(usage?.promptTokens);
      const completionTokens = this.number(usage?.completionTokens);
      const totalTokens = this.number(usage?.totalTokens);
      const costIncrement = Number.isFinite(cost) ? cost : 0;
      await manager
        .getRepository(RunEntity)
        .createQueryBuilder()
        .update()
        .set({
          totalPromptTokens: () => `"totalPromptTokens" + ${promptTokens}`,
          totalCompletionTokens: () =>
            `"totalCompletionTokens" + ${completionTokens}`,
          totalTokens: () => `"totalTokens" + ${totalTokens}`,
          totalCost: () => `"totalCost" + ${costIncrement}`,
          ...(event.eventType === "SESSION_OUTCOME"
            ? {
                status: this.readOutcomeStatus(event.payload.status),
                endedAt: new Date(event.timestamp),
              }
            : {}),
        })
        .where("id = :runId", { runId: run.id })
        .execute();
      return saved;
    });
  }

  /** 최신순 복합 커서와 선택 필터를 적용해 Run 목록을 조회합니다. */
  async listRuns(
    workspaceId: string,
    input: {
      cursor?: string;
      limit: number;
      agentId?: string;
      status?: string;
    },
  ) {
    const query = AppDataSource.getRepository(RunEntity)
      .createQueryBuilder("run")
      .innerJoinAndSelect("run.agent", "agent")
      .where("run.workspaceId = :workspaceId", { workspaceId })
      .orderBy("run.startedAt", "DESC")
      .addOrderBy("run.id", "DESC")
      .take(input.limit + 1);
    if (input.cursor) {
      // 같은 시작 시각의 Run도 누락되지 않도록 startedAt과 id를 함께 사용합니다.
      const separator = input.cursor.lastIndexOf("|");
      const startedAt = input.cursor.slice(0, separator);
      const id = input.cursor.slice(separator + 1);
      query.andWhere(
        "(run.startedAt < :startedAt OR (run.startedAt = :startedAt AND run.id < :id))",
        { startedAt, id },
      );
    }
    if (input.agentId)
      query.andWhere("agent.id = :agentId", { agentId: input.agentId });
    if (input.status)
      query.andWhere("run.status = :status", { status: input.status });
    return query.getMany();
  }

  /** 내부 UUID 또는 SDK runId로 Run과 이벤트를 시간순 조회합니다. */
  async findRun(workspaceId: string, runId: string) {
    return AppDataSource.getRepository(RunEntity)
      .createQueryBuilder("run")
      .innerJoinAndSelect("run.agent", "agent")
      .leftJoinAndSelect("run.events", "event")
      .where("run.workspaceId = :workspaceId", { workspaceId })
      .andWhere("(run.id::text = :runId OR run.clientRunId = :runId)", {
        runId,
      })
      .orderBy("event.timestamp", "ASC")
      .addOrderBy("event.createdAt", "ASC")
      .addOrderBy("event.id", "ASC")
      .take(101)
      .getOne();
  }

  /** Run의 Event를 안정적인 시간순 복합 커서로 조회합니다. */
  async listRunEvents(
    workspaceId: string,
    runId: string,
    input: { cursor?: string; limit: number },
  ) {
    const query = AppDataSource.getRepository(EventEntity)
      .createQueryBuilder("event")
      .innerJoin("event.run", "run")
      .where("run.workspaceId = :workspaceId", { workspaceId })
      .andWhere("(run.id::text = :runId OR run.clientRunId = :runId)", {
        runId,
      })
      .orderBy("event.timestamp", "ASC")
      .addOrderBy("event.createdAt", "ASC")
      .addOrderBy("event.id", "ASC")
      .take(input.limit + 1);
    if (input.cursor) {
      const [timestamp, createdAt, id] = input.cursor.split("|");
      query.andWhere(
        `(
          event.timestamp > :timestamp
          OR (event.timestamp = :timestamp AND event."createdAt" > :createdAt)
          OR (
            event.timestamp = :timestamp
            AND event."createdAt" = :createdAt
            AND event.id > :id
          )
        )`,
        { timestamp, createdAt, id },
      );
    }
    return query.getMany();
  }

  /** 알 수 없는 수치 입력을 집계에 안전한 유한 숫자로 변환합니다. */
  private number(value: unknown): number {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  /** SDK 종료 상태를 저장 모델이 허용하는 값으로 정규화합니다. */
  private readOutcomeStatus(value: unknown): SessionEntity["status"] {
    return value === "COMPLETED" || value === "CANCELLED" ? value : "FAILED";
  }

  /** PostgreSQL unique constraint 충돌인지 판별합니다. */
  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    );
  }
}

/** OpenAPI 이벤트 저장에 사용하는 기본 저장소 인스턴스입니다. */
export const openAPIEventRepository = new OpenAPIEventRepository();
