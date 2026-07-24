import { AgentEntity, EventEntity, SessionEntity } from "@repo/database";
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
      .innerJoin("event.session", "session")
      .where("session.workspaceId = :workspaceId", { workspaceId })
      .andWhere("event.clientId = :clientId", { clientId })
      .andWhere("event.clientEventId = :eventId", { eventId })
      .getOne();
  }

  /** 이벤트의 agentId 또는 이름으로 Agent를 찾고 없으면 생성합니다. */
  async findOrCreateAgent(workspaceId: string, event: IngestEvent) {
    const repository = AppDataSource.getRepository(AgentEntity);
    const agent = await repository.findOne({
      where:
        event.agentId && UUID_PATTERN.test(event.agentId)
          ? [
              { id: event.agentId, workspace: { id: workspaceId } },
              { name: event.agentName, workspace: { id: workspaceId } },
            ]
          : { name: event.agentName, workspace: { id: workspaceId } },
    });
    if (agent) return agent;
    return repository.save(
      repository.create({
        name: event.agentName,
        defaultModel: String(event.payload.model ?? "unknown"),
        workspace: { id: workspaceId },
      }),
    );
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
      where: { name: externalId, workspace: { id: workspaceId } },
    });
    if (session) return session;
    return repository.save(
      repository.create({
        name: externalId,
        status: "RUNNING",
        startedAt: new Date(event.timestamp),
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        workspace: { id: workspaceId },
        agent,
      }),
    );
  }

  /** 이벤트를 저장하고 세션 결과·토큰·비용 집계를 함께 갱신합니다. */
  async saveEvent(session: SessionEntity, event: IngestEvent) {
    const repository = AppDataSource.getRepository(EventEntity);
    const usage = event.payload.usage as Record<string, unknown> | undefined;
    const latency = Number(event.payload.latency);
    const cost = Number(event.payload.cost);
    return repository
      .save(
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
        }),
      )
      .then(async (saved) => {
        // 종료 이벤트가 들어온 시점에만 Session의 최종 상태와 종료 시각을 확정합니다.
        if (event.eventType === "SESSION_OUTCOME") {
          session.status = this.readOutcomeStatus(event.payload.status);
          session.endedAt = new Date(event.timestamp);
        }
        if (usage) {
          session.totalPromptTokens += this.number(usage.promptTokens);
          session.totalCompletionTokens += this.number(usage.completionTokens);
          session.totalTokens += this.number(usage.totalTokens);
        }
        if (Number.isFinite(cost)) session.totalCost += cost;
        if (
          usage ||
          Number.isFinite(cost) ||
          event.eventType === "SESSION_OUTCOME"
        ) {
          await AppDataSource.getRepository(SessionEntity).save(session);
        }
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
    const query = AppDataSource.getRepository(SessionEntity)
      .createQueryBuilder("session")
      .innerJoinAndSelect("session.agent", "agent")
      .where("session.workspaceId = :workspaceId", { workspaceId })
      .orderBy("session.startedAt", "DESC")
      .addOrderBy("session.id", "DESC")
      .take(input.limit + 1);
    if (input.cursor) {
      // 같은 시작 시각의 Run도 누락되지 않도록 startedAt과 id를 함께 사용합니다.
      const separator = input.cursor.lastIndexOf("|");
      const startedAt = input.cursor.slice(0, separator);
      const id = input.cursor.slice(separator + 1);
      query.andWhere(
        "(session.startedAt < :startedAt OR (session.startedAt = :startedAt AND session.id < :id))",
        { startedAt, id },
      );
    }
    if (input.agentId)
      query.andWhere("agent.id = :agentId", { agentId: input.agentId });
    if (input.status)
      query.andWhere("session.status = :status", { status: input.status });
    return query.getMany();
  }

  /** 내부 UUID 또는 SDK runId로 Run과 이벤트를 시간순 조회합니다. */
  async findRun(workspaceId: string, runId: string) {
    return AppDataSource.getRepository(SessionEntity)
      .createQueryBuilder("session")
      .innerJoinAndSelect("session.agent", "agent")
      .leftJoinAndSelect("session.events", "event")
      .where("session.workspaceId = :workspaceId", { workspaceId })
      .andWhere("(session.id::text = :runId OR session.name = :runId)", {
        runId,
      })
      .orderBy("event.timestamp", "ASC")
      .addOrderBy("event.createdAt", "ASC")
      .getOne();
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
}

/** OpenAPI 이벤트 저장에 사용하는 기본 저장소 인스턴스입니다. */
export const openAPIEventRepository = new OpenAPIEventRepository();
