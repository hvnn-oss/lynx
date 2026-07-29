import { createHash, randomBytes } from "node:crypto";
import {
  AgentEntity,
  IssueEntity,
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
  PromptDeploymentOperationsQueryDto,
  PromptExperimentOperationsQueryDto,
  PromptListQueryDto,
  PromptTargetAgentsQueryDto,
  UpdatePromptDto,
} from "@repo/dto";
import { In, IsNull, type Repository } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/** 프롬프트 초안, 불변 버전, 배포 및 실험 저장을 담당합니다. */
export class PromptRepository {
  /** 검색과 운영 상태 필터를 적용한 프롬프트 커서 페이지를 조회합니다. */
  list(workspaceId: string, input: PromptListQueryDto) {
    const query = AppDataSource.getRepository(PromptEntity)
      .createQueryBuilder("prompt")
      .where('prompt."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('prompt."deletedAt" IS NULL')
      .orderBy("prompt.updatedAt", "DESC")
      .addOrderBy("prompt.id", "DESC")
      .take(input.limit + 1);

    if (input.search) {
      query.andWhere(
        "(prompt.name ILIKE :search OR prompt.description ILIKE :search)",
        { search: `%${input.search}%` },
      );
    }
    if (input.cursor) {
      const [updatedAt, id] = input.cursor.split("|");
      query.andWhere(
        '(prompt."updatedAt" < :updatedAt OR (prompt."updatedAt" = :updatedAt AND prompt.id < :id))',
        { updatedAt, id },
      );
    }

    const activeDeployment = query
      .subQuery()
      .select("1")
      .from(PromptDeploymentEntity, "activeDeployment")
      .where('activeDeployment."promptId" = prompt.id')
      .andWhere('activeDeployment."workspaceId" = :workspaceId')
      .andWhere('activeDeployment."active" = true');
    if (input.environment) {
      activeDeployment.andWhere(
        'activeDeployment."environment" = :deploymentEnvironment',
        { deploymentEnvironment: input.environment },
      );
    }
    if (input.deployment === "DEPLOYED") {
      query.andWhere(`EXISTS ${activeDeployment.getQuery()}`);
    } else if (input.deployment === "UNDEPLOYED") {
      query.andWhere(`NOT EXISTS ${activeDeployment.getQuery()}`);
    } else if (input.deployment === "DRAFT_CHANGED") {
      query.andWhere(
        `NOT EXISTS ${query
          .subQuery()
          .select("1")
          .from(PromptVersionEntity, "latestVersion")
          .where('latestVersion."promptId" = prompt.id')
          .andWhere('latestVersion."draftRevision" = prompt."draftRevision"')
          .getQuery()}`,
      );
    }
    return query.getMany();
  }

  /** 목록에 표시할 프롬프트별 최신 불변 버전을 한 번에 조회합니다. */
  listLatestVersions(workspaceId: string, promptIds: string[]) {
    if (promptIds.length === 0) return Promise.resolve([]);
    return AppDataSource.getRepository(PromptVersionEntity)
      .createQueryBuilder("version")
      .distinctOn(["version.promptId"])
      .innerJoin("version.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .andWhere('version."promptId" IN (:...promptIds)', { promptIds })
      .orderBy("version.promptId", "ASC")
      .addOrderBy("version.createdAt", "DESC")
      .getMany();
  }

  /** 목록에 표시할 활성 배포와 버전·Agent 이름을 한 번에 조회합니다. */
  listActiveDeployments(workspaceId: string, promptIds: string[]) {
    if (promptIds.length === 0) return Promise.resolve([]);
    return AppDataSource.getRepository(PromptDeploymentEntity).find({
      where: {
        workspaceId,
        promptId: In(promptIds),
        active: true,
      },
      relations: { version: true, agent: true },
      order: { deployedAt: "DESC" },
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
      relations: { version: true, agent: true },
      order: { deployedAt: "DESC" },
    });
  }

  /** 워크스페이스 전체 배포 이력을 검색 가능한 커서 페이지로 조회합니다. */
  listDeploymentOperations(
    workspaceId: string,
    input: PromptDeploymentOperationsQueryDto,
  ) {
    const query = AppDataSource.getRepository(PromptDeploymentEntity)
      .createQueryBuilder("deployment")
      .innerJoinAndSelect("deployment.prompt", "prompt")
      .innerJoinAndSelect("deployment.version", "version")
      .leftJoinAndSelect("deployment.agent", "agent")
      .where('deployment."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('prompt."deletedAt" IS NULL')
      .orderBy("deployment.deployedAt", "DESC")
      .addOrderBy("deployment.id", "DESC")
      .take(input.limit + 1);
    if (input.promptId) {
      query.andWhere('deployment."promptId" = :promptId', {
        promptId: input.promptId,
      });
    }
    if (input.search) {
      query.andWhere(
        "(prompt.name ILIKE :search OR version.version ILIKE :search OR agent.name ILIKE :search)",
        { search: `%${input.search}%` },
      );
    }
    if (input.environment) {
      query.andWhere("deployment.environment = :environment", {
        environment: input.environment,
      });
    }
    if (input.active !== undefined) {
      query.andWhere("deployment.active = :active", { active: input.active });
    }
    if (input.cursor) {
      const [deployedAt, id] = input.cursor.split("|");
      query.andWhere(
        '(deployment."deployedAt" < :deployedAt OR (deployment."deployedAt" = :deployedAt AND deployment.id < :id))',
        { deployedAt, id },
      );
    }
    return query.getMany();
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

  /** 상태 변경 전에 실험의 환경과 Agent 범위를 조회합니다. */
  findExperiment(workspaceId: string, promptId: string, experimentId: string) {
    return AppDataSource.getRepository(PromptExperimentEntity).findOneBy({
      id: experimentId,
      workspaceId,
      promptId,
    });
  }

  /** 실험 범위에 기준이 될 활성 프롬프트 배포가 있는지 확인합니다. */
  findActiveDeployment(
    workspaceId: string,
    promptId: string,
    environment: string,
    agentId: string | null,
  ) {
    return AppDataSource.getRepository(PromptDeploymentEntity).findOneBy({
      workspaceId,
      promptId,
      environment,
      agentId: agentId ?? IsNull(),
      active: true,
    });
  }

  /** 워크스페이스 전체 실험을 검색 가능한 커서 페이지로 조회합니다. */
  listExperimentOperations(
    workspaceId: string,
    input: PromptExperimentOperationsQueryDto,
  ) {
    const query = AppDataSource.getRepository(PromptExperimentEntity)
      .createQueryBuilder("experiment")
      .innerJoinAndSelect("experiment.prompt", "prompt")
      .leftJoinAndSelect("experiment.agent", "agent")
      .where('experiment."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('prompt."deletedAt" IS NULL')
      .orderBy("experiment.createdAt", "DESC")
      .addOrderBy("experiment.id", "DESC")
      .take(input.limit + 1);
    if (input.promptId) {
      query.andWhere('experiment."promptId" = :promptId', {
        promptId: input.promptId,
      });
    }
    if (input.search) {
      query.andWhere(
        "(experiment.name ILIKE :search OR prompt.name ILIKE :search OR agent.name ILIKE :search)",
        { search: `%${input.search}%` },
      );
    }
    if (input.environment) {
      query.andWhere("experiment.environment = :environment", {
        environment: input.environment,
      });
    }
    if (input.status) {
      query.andWhere("experiment.status = :status", { status: input.status });
    }
    if (input.cursor) {
      const [createdAt, id] = input.cursor.split("|");
      query.andWhere(
        '(experiment."createdAt" < :createdAt OR (experiment."createdAt" = :createdAt AND experiment.id < :id))',
        { createdAt, id },
      );
    }
    return query.getMany();
  }

  /** 여러 실험 변형에서 참조하는 버전을 한 번에 조회합니다. */
  listVersionsByIds(workspaceId: string, versionIds: string[]) {
    if (versionIds.length === 0) return Promise.resolve([]);
    return AppDataSource.getRepository(PromptVersionEntity).find({
      where: {
        id: In(versionIds),
        workspace: { id: workspaceId },
      },
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
        experiment.startedAt = new Date();
        experiment.endedAt = null;
      } else {
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

  /** 여러 프롬프트 버전의 Run 지표를 한 SQL로 집계합니다. */
  async getVersionMetricsBatch(workspaceId: string, versionIds: string[]) {
    if (versionIds.length === 0) return [];
    return AppDataSource.query<
      Array<{
        versionId: string;
        runCount: string;
        successCount: string;
        errorRunCount: string;
        totalCost: string;
      }>
    >(
      `
        WITH matched_runs AS (
          SELECT DISTINCT
            prompt_version.value AS "versionId",
            run.id,
            run.status,
            run."totalCost"
          FROM "run" run
          INNER JOIN "event" event ON event."runId" = run.id
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(event.payload->'promptVersionIds', '[]'::jsonb)
          ) AS prompt_version(value)
          WHERE run."workspaceId" = $1
            AND prompt_version.value = ANY($2::text[])
        ),
        error_runs AS (
          SELECT DISTINCT
            prompt_version.value AS "versionId",
            event."runId"
          FROM "event" event
          CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(event.payload->'promptVersionIds', '[]'::jsonb)
          ) AS prompt_version(value)
          WHERE prompt_version.value = ANY($2::text[])
            AND event."eventType" = 'ERROR'
        )
        SELECT
          matched_runs."versionId",
          COUNT(*)::text AS "runCount",
          COUNT(*) FILTER (
            WHERE matched_runs.status = 'COMPLETED'
          )::text AS "successCount",
          COUNT(*) FILTER (
            WHERE matched_runs.status = 'FAILED'
              OR EXISTS (
                SELECT 1
                FROM error_runs
                WHERE error_runs."versionId" = matched_runs."versionId"
                  AND error_runs."runId" = matched_runs.id
              )
          )::text AS "errorRunCount",
          COALESCE(SUM(matched_runs."totalCost"), 0)::text AS "totalCost"
        FROM matched_runs
        GROUP BY matched_runs."versionId"
      `,
      [workspaceId, versionIds],
    );
  }

  /** 버전별 변경 영향 이슈 개수를 한 번에 집계합니다. */
  async countChangeImpactIssuesByVersion(
    workspaceId: string,
    versionIds: string[],
  ) {
    if (versionIds.length === 0) return [];
    return AppDataSource.getRepository(IssueEntity)
      .createQueryBuilder("issue")
      .select('issue."representativePromptVersionId"', "versionId")
      .addSelect("COUNT(*)", "issueCount")
      .where('issue."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("issue.category = 'PROMPT_REGRESSION'")
      .andWhere('issue."representativePromptVersionId" IN (:...versionIds)', {
        versionIds,
      })
      .groupBy('issue."representativePromptVersionId"')
      .getRawMany<{ versionId: string; issueCount: string }>();
  }

  /** 프롬프트 운영 상단 지표와 마지막 설정 변경 시각을 집계합니다. */
  async getOperationsSummary(workspaceId: string) {
    const [
      promptCount,
      versionCount,
      activeDeploymentCount,
      activeExperimentCount,
      changeImpactIssueCount,
      changedRows,
    ] = await Promise.all([
      AppDataSource.getRepository(PromptEntity).countBy({
        workspaceId,
        deletedAt: IsNull(),
      }),
      AppDataSource.getRepository(PromptVersionEntity)
        .createQueryBuilder("version")
        .innerJoin("version.workspace", "workspace")
        .where("workspace.id = :workspaceId", { workspaceId })
        .getCount(),
      AppDataSource.getRepository(PromptDeploymentEntity).countBy({
        workspaceId,
        active: true,
      }),
      AppDataSource.getRepository(PromptExperimentEntity).countBy({
        workspaceId,
        status: "ACTIVE",
      }),
      AppDataSource.getRepository(IssueEntity).countBy({
        workspaceId,
        category: "PROMPT_REGRESSION",
      }),
      AppDataSource.query<Array<{ changedAt: Date | string | null }>>(
        `
          SELECT MAX(changed_at) AS "changedAt"
          FROM (
            SELECT deployment."deployedAt" AS changed_at
            FROM "prompt_deployment" deployment
            WHERE deployment."workspaceId" = $1
            UNION ALL
            SELECT GREATEST(
              experiment."createdAt",
              COALESCE(experiment."startedAt", experiment."createdAt"),
              COALESCE(experiment."endedAt", experiment."createdAt")
            ) AS changed_at
            FROM "prompt_experiment" experiment
            WHERE experiment."workspaceId" = $1
          ) changes
        `,
        [workspaceId],
      ),
    ]);
    return {
      promptCount,
      versionCount,
      activeDeploymentCount,
      activeExperimentCount,
      changeImpactIssueCount,
      changedAt: changedRows[0]?.changedAt ?? null,
    };
  }

  /** 배포와 실험 대상으로 선택할 Agent를 이름순으로 조회합니다. */
  listTargetAgents(workspaceId: string, input: PromptTargetAgentsQueryDto) {
    const query = AppDataSource.getRepository(AgentEntity)
      .createQueryBuilder("agent")
      .innerJoin("agent.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .orderBy("agent.name", "ASC")
      .addOrderBy("agent.id", "ASC")
      .take(input.limit);
    if (input.search) {
      query.andWhere(
        "(agent.name ILIKE :search OR agent.clientAgentId ILIKE :search)",
        { search: `%${input.search}%` },
      );
    }
    return query.getMany();
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
