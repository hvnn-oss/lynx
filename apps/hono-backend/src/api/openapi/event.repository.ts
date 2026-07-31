import {
  AgentEntity,
  EventEntity,
  FirewallPolicyEntity,
  FirewallViolationEntity,
  PromptExperimentEntity,
  PromptExperimentExposureEntity,
  RunEntity,
  SessionEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { firewallNotificationService } from "../../common/services/firewall-notification.service.js";
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
  async saveEvent(
    workspaceId: string,
    agent: AgentEntity,
    session: SessionEntity,
    run: RunEntity,
    event: IngestEvent,
  ) {
    const usage = event.payload.usage as Record<string, unknown> | undefined;
    const latency = Number(event.payload.latency);
    const cost = this.optionalNumber(event.payload.cost);
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
          cost: cost ?? undefined,
          timestamp: new Date(event.timestamp),
          session,
          run,
        }),
      );

      await this.saveFirewallViolation(
        manager,
        workspaceId,
        agent,
        session,
        saved,
        event,
      );
      await this.savePromptExperimentExposures(
        manager,
        workspaceId,
        agent,
        session,
        run,
        event,
      );
      const policyAction = String(event.payload.action ?? "");
      if (event.eventType === "POLICY_EVALUATION" && policyAction === "BLOCK") {
        await firewallNotificationService.enqueueConfigured(manager, {
          workspaceId,
          policyId:
            typeof event.payload.policyId === "string"
              ? event.payload.policyId
              : null,
          type: "firewall.blocked",
          deduplicationKey: `firewall.blocked:${event.clientId}:${event.eventId}`,
          data: {
            action: policyAction,
            toolName: event.payload.toolName,
            reason: event.payload.reason,
            runId: event.runId,
            sessionId: event.sessionId,
            agentId: event.agentId,
            eventId: event.eventId,
          },
        });
      }

      const promptTokens = this.number(usage?.promptTokens);
      const completionTokens = this.number(usage?.completionTokens);
      const totalTokens = this.number(usage?.totalTokens);
      const costIncrement = cost ?? 0;
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

  /**
   * Stores verified experiment assignments once per Run and prompt.
   *
   * The API key determines the workspace and environment. Client-provided
   * assignments are accepted only when they match an experiment and variant
   * that belong to that authenticated scope.
   */
  private async savePromptExperimentExposures(
    manager: EntityManager,
    workspaceId: string,
    agent: AgentEntity,
    session: SessionEntity,
    run: RunEntity,
    event: IngestEvent,
  ): Promise<void> {
    const exposures = this.readPromptExperimentExposures(
      event.payload.promptExposures,
    );
    if (exposures.length === 0) return;

    const environment =
      typeof event.payload.environment === "string"
        ? event.payload.environment
        : null;
    if (!environment) return;

    const experiments = manager.getRepository(PromptExperimentEntity);
    const exposureRepository = manager.getRepository(
      PromptExperimentExposureEntity,
    );
    for (const exposure of exposures) {
      const experiment = await experiments.findOneBy({
        id: exposure.experimentId,
        workspaceId,
        promptId: exposure.promptId,
      });
      if (
        !experiment ||
        experiment.environment !== environment ||
        (experiment.agentId !== null && experiment.agentId !== agent.id) ||
        !experiment.variants.some(
          (variant) => variant.versionId === exposure.promptVersionId,
        )
      ) {
        continue;
      }

      await exposureRepository
        .createQueryBuilder()
        .insert()
        .into(PromptExperimentExposureEntity)
        .values({
          workspaceId,
          experimentId: experiment.id,
          promptId: exposure.promptId,
          promptVersionId: exposure.promptVersionId,
          runId: run.id,
          sessionId: session.id,
          agentId: agent.id,
          environment,
          bucket: exposure.bucket,
          runtimeConfigRevision: exposure.runtimeConfigRevision,
          exposedAt: new Date(event.timestamp),
        })
        .orIgnore()
        .execute();
    }
  }

  /** Parses bounded, non-sensitive experiment metadata from an SDK payload. */
  private readPromptExperimentExposures(value: unknown): Array<{
    experimentId: string;
    promptId: string;
    promptVersionId: string;
    bucket: number;
    runtimeConfigRevision: string;
  }> {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const item of value.slice(0, 20)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const exposure = item as Record<string, unknown>;
      const bucket = Number(exposure.bucket);
      if (
        typeof exposure.experimentId !== "string" ||
        !UUID_PATTERN.test(exposure.experimentId) ||
        typeof exposure.promptId !== "string" ||
        !UUID_PATTERN.test(exposure.promptId) ||
        typeof exposure.promptVersionId !== "string" ||
        !UUID_PATTERN.test(exposure.promptVersionId) ||
        !Number.isInteger(bucket) ||
        bucket < 0 ||
        bucket > 99 ||
        typeof exposure.runtimeConfigRevision !== "string" ||
        exposure.runtimeConfigRevision.length < 1 ||
        exposure.runtimeConfigRevision.length > 255
      ) {
        continue;
      }
      result.push({
        experimentId: exposure.experimentId,
        promptId: exposure.promptId,
        promptVersionId: exposure.promptVersionId,
        bucket,
        runtimeConfigRevision: exposure.runtimeConfigRevision,
      });
    }
    return result;
  }

  /** 비허용 정책 평가 이벤트를 중복 없이 방화벽 위반 레코드로 남깁니다. */
  private async saveFirewallViolation(
    manager: EntityManager,
    workspaceId: string,
    agent: AgentEntity,
    session: SessionEntity,
    savedEvent: EventEntity,
    event: IngestEvent,
  ): Promise<void> {
    if (event.eventType !== "POLICY_EVALUATION") return;
    const action = String(event.payload.action ?? "ALLOW");
    if (
      action !== "WARN" &&
      action !== "BLOCK" &&
      action !== "REQUIRE_APPROVAL"
    ) {
      return;
    }

    const reportedPolicyId =
      typeof event.payload.policyId === "string"
        ? event.payload.policyId
        : null;
    const policy =
      reportedPolicyId && /^\d+$/.test(reportedPolicyId)
        ? await manager.getRepository(FirewallPolicyEntity).findOne({
            where: {
              id: Number(reportedPolicyId),
              workspace: { id: workspaceId },
            },
          })
        : null;
    const metadata =
      event.payload.metadata &&
      typeof event.payload.metadata === "object" &&
      !Array.isArray(event.payload.metadata)
        ? (event.payload.metadata as Record<string, unknown>)
        : null;
    const evidence = {
      argsHash:
        typeof event.payload.argsHash === "string"
          ? event.payload.argsHash
          : null,
      policyVersion:
        typeof event.payload.policyVersion === "string"
          ? event.payload.policyVersion
          : null,
      allow:
        typeof event.payload.allow === "boolean" ? event.payload.allow : null,
      metadata,
    };
    const violations = manager.getRepository(FirewallViolationEntity);
    await violations.save(
      violations.create({
        action: action as FirewallViolationEntity["action"],
        createdAt: new Date(event.timestamp),
        workspaceId,
        eventId: savedEvent.id,
        reportedPolicyId,
        toolName:
          typeof event.payload.toolName === "string"
            ? event.payload.toolName
            : null,
        severity:
          typeof event.payload.severity === "string"
            ? event.payload.severity
            : null,
        message:
          typeof event.payload.reason === "string"
            ? event.payload.reason
            : null,
        evidence,
        reason: policy,
        session,
        agent,
      }),
    );
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

  /** null이나 빈 값이 실제 0달러 비용으로 저장되지 않게 구분합니다. */
  private optionalNumber(value: unknown): number | null {
    if (
      (typeof value !== "number" && typeof value !== "string") ||
      value === ""
    ) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
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
