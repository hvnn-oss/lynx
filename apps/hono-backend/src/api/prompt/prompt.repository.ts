import { createHash, randomBytes } from "node:crypto";
import {
  AgentEntity,
  PromptDeploymentEntity,
  PromptEntity,
  PromptExperimentEntity,
  PromptVersionEntity,
} from "@repo/database";
import type {
  CreatePromptDto,
  CreatePromptExperimentDto,
  CreatePromptVersionDto,
  DeployPromptDto,
  UpdatePromptDto,
} from "@repo/dto";
import { In, IsNull, type Repository } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/** 프롬프트 초안, 불변 버전, 배포 및 실험 저장을 담당합니다. */
export class PromptRepository {
  /** 삭제되지 않은 워크스페이스 프롬프트를 조회합니다. */
  list(workspaceId: string) {
    return AppDataSource.getRepository(PromptEntity).find({
      where: { workspaceId, deletedAt: IsNull() },
      order: { updatedAt: "DESC" },
    });
  }

  /** 워크스페이스 경계 안에서 프롬프트를 조회합니다. */
  find(workspaceId: string, promptId: string) {
    return AppDataSource.getRepository(PromptEntity).findOneBy({
      id: promptId,
      workspaceId,
      deletedAt: IsNull(),
    });
  }

  /** 새 프롬프트 초안을 생성합니다. */
  create(workspaceId: string, userId: string, body: CreatePromptDto) {
    const repository = AppDataSource.getRepository(PromptEntity);
    const now = new Date();
    return repository.save(
      repository.create({
        workspaceId,
        name: body.name,
        description: body.description,
        currentVersion: "",
        draftContent: body.draftContent,
        draftRevision: 1,
        draftUpdatedByUserId: userId,
        deletedAt: null,
        version: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  /** 예상 초안 리비전이 일치할 때만 프롬프트를 갱신합니다. */
  async update(
    workspaceId: string,
    promptId: string,
    userId: string,
    body: UpdatePromptDto,
  ) {
    const values = {
      draftRevision: body.expectedDraftRevision + 1,
      draftUpdatedByUserId: userId,
      updatedAt: new Date(),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.draftContent !== undefined
        ? { draftContent: body.draftContent }
        : {}),
    };
    const result = await AppDataSource.getRepository(PromptEntity).update(
      {
        id: promptId,
        workspaceId,
        draftRevision: body.expectedDraftRevision,
        deletedAt: IsNull(),
      },
      values,
    );
    return result.affected === 1 ? this.find(workspaceId, promptId) : null;
  }

  /** 참조 이력을 보존하면서 프롬프트를 소프트 삭제합니다. */
  async softDelete(prompt: PromptEntity) {
    prompt.deletedAt = new Date();
    prompt.updatedAt = prompt.deletedAt;
    await AppDataSource.getRepository(PromptEntity).save(prompt);
  }

  /** 현재 초안 리비전에서 수정 불가능한 버전 스냅샷을 생성합니다. */
  createVersion(
    workspaceId: string,
    promptId: string,
    userId: string,
    body: CreatePromptVersionDto,
  ) {
    return AppDataSource.transaction(async (manager) => {
      const prompts = manager.getRepository(PromptEntity);
      const prompt = await prompts
        .createQueryBuilder("prompt")
        .setLock("pessimistic_write")
        .where("prompt.id = :promptId", { promptId })
        .andWhere("prompt.workspaceId = :workspaceId", { workspaceId })
        .andWhere("prompt.deletedAt IS NULL")
        .getOne();
      if (!prompt || prompt.draftRevision !== body.expectedDraftRevision) {
        return null;
      }
      const versions = manager.getRepository(PromptVersionEntity);
      if (body.baseVersionId) {
        const base = await versions.findOneBy({
          id: body.baseVersionId,
          promptId,
        });
        if (!base) return null;
      }
      const version = await versions.save(
        versions.create({
          promptId,
          version: body.version,
          content: body.content,
          contentHash: createHash("sha256")
            .update(body.content, "utf8")
            .digest("hex"),
          baseVersionId: body.baseVersionId ?? null,
          changeReason: body.changeReason ?? null,
          createdBy: null,
          createdByUserId: userId,
          draftRevision: body.expectedDraftRevision,
          createdAt: new Date(),
          workspace: { id: workspaceId },
        }),
      );
      return version;
    });
  }

  /** 프롬프트의 불변 버전 이력을 최신순으로 조회합니다. */
  listVersions(workspaceId: string, promptId: string) {
    return AppDataSource.getRepository(PromptVersionEntity).find({
      where: { promptId, workspace: { id: workspaceId } },
      order: { createdAt: "DESC" },
    });
  }

  /** 비교나 배포에 사용할 프롬프트 버전을 조회합니다. */
  findVersion(workspaceId: string, promptId: string, versionId: string) {
    return AppDataSource.getRepository(PromptVersionEntity).findOne({
      where: {
        id: versionId,
        promptId,
        workspace: { id: workspaceId },
      },
    });
  }

  /** 자동 회귀 검사에서 버전과 기준 버전을 식별자로 조회합니다. */
  findVersionById(workspaceId: string, versionId: string) {
    return AppDataSource.getRepository(PromptVersionEntity).findOne({
      where: {
        id: versionId,
        workspace: { id: workspaceId },
      },
    });
  }

  /** 환경 및 Agent 범위의 현재 배포를 원자적으로 교체합니다. */
  deploy(
    workspaceId: string,
    promptId: string,
    userId: string,
    body: DeployPromptDto,
  ) {
    return AppDataSource.transaction(async (manager) => {
      const version = await manager.getRepository(PromptVersionEntity).findOne({
        where: {
          id: body.versionId,
          promptId,
          workspace: { id: workspaceId },
        },
      });
      if (!version) return { kind: "VERSION_NOT_FOUND" as const };
      if (body.agentId) {
        const agent = await manager.getRepository(AgentEntity).findOne({
          where: { id: body.agentId, workspace: { id: workspaceId } },
        });
        if (!agent) return { kind: "AGENT_NOT_FOUND" as const };
      }
      const deployments = manager.getRepository(PromptDeploymentEntity);
      const activeQuery = deployments
        .createQueryBuilder("deployment")
        .setLock("pessimistic_write")
        .where("deployment.workspaceId = :workspaceId", { workspaceId })
        .andWhere("deployment.promptId = :promptId", { promptId })
        .andWhere("deployment.environment = :environment", {
          environment: body.environment,
        })
        .andWhere("deployment.active = true");
      if (body.agentId) {
        activeQuery.andWhere("deployment.agentId = :agentId", {
          agentId: body.agentId,
        });
      } else {
        activeQuery.andWhere("deployment.agentId IS NULL");
      }
      const current = await activeQuery.getOne();
      if (
        body.expectedDeploymentId !== undefined &&
        (current?.id ?? null) !== body.expectedDeploymentId
      ) {
        return { kind: "CONFLICT" as const };
      }
      if (current) {
        current.active = false;
        current.supersededAt = new Date();
        await deployments.save(current);
      }
      const deployment = await deployments.save(
        deployments.create({
          workspaceId,
          promptId,
          versionId: version.id,
          environment: body.environment,
          agentId: body.agentId ?? null,
          active: true,
          supersedesDeploymentId: current?.id ?? null,
          reason: body.reason ?? null,
          deployedByUserId: userId,
          supersededAt: null,
        }),
      );
      if (body.environment === "production" && !body.agentId) {
        await manager.getRepository(PromptEntity).update(promptId, {
          currentVersion: version.version,
          version: { id: version.id },
          updatedAt: new Date(),
        });
      }
      return { kind: "DEPLOYED" as const, deployment, version };
    });
  }

  /** 프롬프트 배포 이력을 최신순으로 조회합니다. */
  listDeployments(workspaceId: string, promptId: string) {
    return AppDataSource.getRepository(PromptDeploymentEntity).find({
      where: { workspaceId, promptId },
      relations: { version: true },
      order: { deployedAt: "DESC" },
    });
  }

  /** A/B 실험을 생성하고 선택적으로 즉시 활성화합니다. */
  createExperiment(
    workspaceId: string,
    promptId: string,
    userId: string,
    body: CreatePromptExperimentDto,
  ) {
    return AppDataSource.transaction(async (manager) => {
      const versionCount = await manager
        .getRepository(PromptVersionEntity)
        .countBy({
          promptId,
          workspace: { id: workspaceId },
          id: In(body.variants.map((variant) => variant.versionId)),
        });
      const uniqueVersionIds = new Set(
        body.variants.map((variant) => variant.versionId),
      );
      if (versionCount !== uniqueVersionIds.size) return null;
      const repository = manager.getRepository(PromptExperimentEntity);
      if (body.activate) {
        await this.pauseActiveExperiment(
          repository,
          workspaceId,
          promptId,
          body.environment,
          body.agentId ?? null,
        );
      }
      return repository.save(
        repository.create({
          workspaceId,
          promptId,
          name: body.name,
          environment: body.environment,
          agentId: body.agentId ?? null,
          variants: body.variants,
          status: body.activate ? "ACTIVE" : "DRAFT",
          assignmentSalt: randomBytes(24).toString("hex"),
          createdByUserId: userId,
          startedAt: body.activate ? new Date() : null,
          endedAt: null,
        }),
      );
    });
  }

  /** 프롬프트의 A/B 실험 이력을 최신순으로 조회합니다. */
  listExperiments(workspaceId: string, promptId: string) {
    return AppDataSource.getRepository(PromptExperimentEntity).find({
      where: { workspaceId, promptId },
      order: { createdAt: "DESC" },
    });
  }

  /** 실험 상태를 변경하고 같은 범위의 활성 실험을 하나로 제한합니다. */
  updateExperimentStatus(
    workspaceId: string,
    promptId: string,
    experimentId: string,
    status: "ACTIVE" | "PAUSED" | "COMPLETED",
  ) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PromptExperimentEntity);
      const experiment = await repository.findOneBy({
        id: experimentId,
        workspaceId,
        promptId,
      });
      if (!experiment) return null;
      if (status === "ACTIVE") {
        await this.pauseActiveExperiment(
          repository,
          workspaceId,
          promptId,
          experiment.environment,
          experiment.agentId,
          experiment.id,
        );
        experiment.startedAt ??= new Date();
        experiment.endedAt = null;
      } else if (status === "COMPLETED") {
        experiment.endedAt = new Date();
      }
      experiment.status = status;
      return repository.save(experiment);
    });
  }

  /** 특정 버전을 사용한 Run의 성공률, 오류율 및 비용을 집계합니다. */
  async getVersionMetrics(
    workspaceId: string,
    versionId: string,
    from?: string,
    to?: string,
  ) {
    const rows = await AppDataSource.query<
      Array<{
        runCount: string;
        successCount: string;
        errorRunCount: string;
        totalCost: string;
      }>
    >(
      `
        WITH matched_runs AS (
          SELECT DISTINCT run.id, run.status, run."totalCost"
          FROM "run" run
          INNER JOIN "event" event ON event."runId" = run.id
          WHERE run."workspaceId" = $1
            AND event.payload->'promptVersionIds' ? $2
            AND ($3::timestamptz IS NULL OR run."startedAt" >= $3)
            AND ($4::timestamptz IS NULL OR run."startedAt" <= $4)
        ),
        error_runs AS (
          SELECT DISTINCT event."runId"
          FROM "event" event
          INNER JOIN matched_runs run ON run.id = event."runId"
          WHERE event."eventType" = 'ERROR'
        )
        SELECT
          COUNT(*)::text AS "runCount",
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS "successCount",
          COUNT(*) FILTER (
            WHERE status = 'FAILED'
              OR id IN (SELECT "runId" FROM error_runs)
          )::text AS "errorRunCount",
          COALESCE(SUM("totalCost"), 0)::text AS "totalCost"
        FROM matched_runs
      `,
      [workspaceId, versionId, from ?? null, to ?? null],
    );
    return rows[0]!;
  }

  /** 같은 범위에 이미 활성화된 실험을 일시 정지합니다. */
  private async pauseActiveExperiment(
    repository: Repository<PromptExperimentEntity>,
    workspaceId: string,
    promptId: string,
    environment: string,
    agentId: string | null,
    exceptId?: string,
  ) {
    const query = repository
      .createQueryBuilder()
      .update()
      .set({ status: "PAUSED" })
      .where('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere('"promptId" = :promptId', { promptId })
      .andWhere("environment = :environment", { environment })
      .andWhere("status = 'ACTIVE'");
    if (agentId) query.andWhere('"agentId" = :agentId', { agentId });
    else query.andWhere('"agentId" IS NULL');
    if (exceptId) query.andWhere("id != :exceptId", { exceptId });
    await query.execute();
  }
}

export const promptRepository = new PromptRepository();
