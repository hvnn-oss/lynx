import type {
  CreatePromptDto,
  CreatePromptExperimentDto,
  CreatePromptVersionDto,
  DeployPromptDto,
  UpdatePromptDto,
} from "@repo/dto";
import type {
  PromptDeploymentEntity,
  PromptEntity,
  PromptExperimentEntity,
  PromptVersionEntity,
} from "@repo/database";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import { ConflictErrorException } from "../../common/exceptions/conflict.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import { createPromptLineDiff } from "../../common/prompt/line-diff.js";
import { runtimeConfigService } from "../openapi/runtime-config/runtime-config.service.js";
import { PromptRepository, promptRepository } from "./prompt.repository.js";

/** 프롬프트 초안부터 버전, 배포, 실험까지 운영 유스케이스를 처리합니다. */
export class PromptService {
  constructor(
    private readonly repository: PromptRepository = promptRepository,
    private readonly accessControl: AccessControlService = accessControlService,
  ) {}

  /** 워크스페이스 프롬프트 목록을 반환합니다. */
  async list(userId: string, workspaceId: string) {
    await this.assertRead(userId, workspaceId);
    return {
      items: (await this.repository.list(workspaceId)).map((prompt) =>
        this.toPrompt(prompt),
      ),
    };
  }

  /** 프롬프트 초안 한 개를 반환합니다. */
  async get(userId: string, workspaceId: string, promptId: string) {
    await this.assertRead(userId, workspaceId);
    return this.toPrompt(await this.findPrompt(workspaceId, promptId));
  }

  /** 새 프롬프트와 첫 초안을 생성합니다. */
  async create(userId: string, workspaceId: string, body: CreatePromptDto) {
    await this.assertWrite(userId, workspaceId);
    try {
      return {
        prompt: this.toPrompt(
          await this.repository.create(workspaceId, userId, body),
        ),
      };
    } catch (error) {
      this.rethrowUniqueConflict(error, "PROMPT_NAME_ALREADY_EXISTS");
    }
  }

  /** 낙관적 잠금으로 최신 초안만 수정합니다. */
  async update(
    userId: string,
    workspaceId: string,
    promptId: string,
    body: UpdatePromptDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    await this.findPrompt(workspaceId, promptId);
    try {
      const prompt = await this.repository.update(
        workspaceId,
        promptId,
        userId,
        body,
      );
      if (!prompt) throw new ConflictErrorException("PROMPT_DRAFT_CONFLICT");
      return { prompt: this.toPrompt(prompt) };
    } catch (error) {
      this.rethrowUniqueConflict(error, "PROMPT_NAME_ALREADY_EXISTS");
    }
  }

  /** 배포와 버전 이력을 남긴 채 프롬프트를 소프트 삭제합니다. */
  async delete(userId: string, workspaceId: string, promptId: string) {
    await this.assertWrite(userId, workspaceId);
    await this.repository.softDelete(
      await this.findPrompt(workspaceId, promptId),
    );
    runtimeConfigService.invalidate(workspaceId);
    return { deleted: true as const };
  }

  /** 현재 초안을 수정 불가능한 버전 스냅샷으로 저장합니다. */
  async createVersion(
    userId: string,
    workspaceId: string,
    promptId: string,
    body: CreatePromptVersionDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    const prompt = await this.findPrompt(workspaceId, promptId);
    if (prompt.draftRevision !== body.expectedDraftRevision) {
      throw new ConflictErrorException("PROMPT_DRAFT_CONFLICT");
    }
    if ((prompt.draftContent ?? "") !== body.content) {
      throw new ConflictErrorException("PROMPT_CONTENT_IS_NOT_CURRENT_DRAFT");
    }
    if (
      body.baseVersionId &&
      !(await this.repository.findVersion(
        workspaceId,
        promptId,
        body.baseVersionId,
      ))
    ) {
      throw new NotFoundErrorException("BASE_PROMPT_VERSION_NOT_FOUND");
    }
    try {
      const version = await this.repository.createVersion(
        workspaceId,
        promptId,
        userId,
        body,
      );
      if (!version) throw new ConflictErrorException("PROMPT_DRAFT_CONFLICT");
      return this.toVersion(version);
    } catch (error) {
      this.rethrowUniqueConflict(error, "PROMPT_VERSION_ALREADY_EXISTS");
    }
  }

  /** 프롬프트의 모든 불변 버전을 최신순으로 반환합니다. */
  async listVersions(userId: string, workspaceId: string, promptId: string) {
    await this.assertRead(userId, workspaceId);
    await this.findPrompt(workspaceId, promptId);
    return {
      items: (await this.repository.listVersions(workspaceId, promptId)).map(
        (version) => this.toVersion(version),
      ),
    };
  }

  /** 두 불변 버전을 줄 단위로 비교합니다. */
  async compareVersions(
    userId: string,
    workspaceId: string,
    promptId: string,
    fromVersionId: string,
    toVersionId: string,
  ) {
    await this.assertRead(userId, workspaceId);
    const [from, to] = await Promise.all([
      this.findVersion(workspaceId, promptId, fromVersionId),
      this.findVersion(workspaceId, promptId, toVersionId),
    ]);
    try {
      return {
        fromVersionId,
        toVersionId,
        changes: createPromptLineDiff(from.content, to.content),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "PROMPT_DIFF_TOO_LARGE") {
        throw new BadRequestErrorException(error.message);
      }
      throw error;
    }
  }

  /** 환경 및 Agent 범위에 특정 버전을 배포합니다. */
  async deploy(
    userId: string,
    workspaceId: string,
    promptId: string,
    body: DeployPromptDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    await this.findPrompt(workspaceId, promptId);
    let result: Awaited<ReturnType<PromptRepository["deploy"]>>;
    try {
      result = await this.repository.deploy(
        workspaceId,
        promptId,
        userId,
        body,
      );
    } catch (error) {
      this.rethrowUniqueConflict(error, "PROMPT_DEPLOYMENT_CONFLICT");
    }
    if (result.kind === "VERSION_NOT_FOUND") {
      throw new NotFoundErrorException("PROMPT_VERSION_NOT_FOUND");
    }
    if (result.kind === "AGENT_NOT_FOUND") {
      throw new NotFoundErrorException("AGENT_NOT_FOUND");
    }
    if (result.kind === "CONFLICT") {
      throw new ConflictErrorException("PROMPT_DEPLOYMENT_CONFLICT");
    }
    runtimeConfigService.invalidate(workspaceId);
    return this.toDeployment(result.deployment, result.version);
  }

  /** 과거 버전을 새 배포 레코드로 지정해 롤백 이력을 남깁니다. */
  rollback(
    userId: string,
    workspaceId: string,
    promptId: string,
    body: DeployPromptDto,
  ) {
    return this.deploy(userId, workspaceId, promptId, body);
  }

  /** 프롬프트의 배포 및 롤백 이력을 반환합니다. */
  async listDeployments(userId: string, workspaceId: string, promptId: string) {
    await this.assertRead(userId, workspaceId);
    await this.findPrompt(workspaceId, promptId);
    return {
      items: (await this.repository.listDeployments(workspaceId, promptId)).map(
        (deployment) => this.toDeployment(deployment, deployment.version),
      ),
    };
  }

  /** 프롬프트 버전을 사용한 Run의 품질과 비용 지표를 집계합니다. */
  async getVersionMetrics(
    userId: string,
    workspaceId: string,
    promptId: string,
    versionId: string,
    query: { from?: string; to?: string },
  ) {
    await this.assertRead(userId, workspaceId);
    await this.findVersion(workspaceId, promptId, versionId);
    const metrics = await this.repository.getVersionMetrics(
      workspaceId,
      versionId,
      query.from,
      query.to,
    );
    const runCount = Number(metrics.runCount);
    const successCount = Number(metrics.successCount);
    const errorRunCount = Number(metrics.errorRunCount);
    const totalCost = Number(metrics.totalCost);
    return {
      versionId,
      runCount,
      successRate: runCount > 0 ? successCount / runCount : 0,
      errorRate: runCount > 0 ? errorRunCount / runCount : 0,
      totalCost,
      averageCost: runCount > 0 ? totalCost / runCount : 0,
    };
  }

  /** 검증된 버전 가중치로 A/B 실험을 생성합니다. */
  async createExperiment(
    userId: string,
    workspaceId: string,
    promptId: string,
    body: CreatePromptExperimentDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    await this.findPrompt(workspaceId, promptId);
    let experiment: Awaited<ReturnType<PromptRepository["createExperiment"]>>;
    try {
      experiment = await this.repository.createExperiment(
        workspaceId,
        promptId,
        userId,
        body,
      );
    } catch (error) {
      this.rethrowUniqueConflict(error, "PROMPT_EXPERIMENT_CONFLICT");
    }
    if (!experiment) {
      throw new NotFoundErrorException("EXPERIMENT_PROMPT_VERSION_NOT_FOUND");
    }
    if (body.activate) runtimeConfigService.invalidate(workspaceId);
    return this.toExperiment(experiment);
  }

  /** 프롬프트에 생성된 A/B 실험과 현재 상태를 최신순으로 반환합니다. */
  async listExperiments(userId: string, workspaceId: string, promptId: string) {
    await this.assertRead(userId, workspaceId);
    await this.findPrompt(workspaceId, promptId);
    return {
      items: (await this.repository.listExperiments(workspaceId, promptId)).map(
        (experiment) => this.toExperiment(experiment),
      ),
    };
  }

  /** A/B 실험을 활성화, 일시 정지 또는 종료합니다. */
  async updateExperimentStatus(
    userId: string,
    workspaceId: string,
    promptId: string,
    experimentId: string,
    status: "ACTIVE" | "PAUSED" | "COMPLETED",
  ) {
    await this.assertWrite(userId, workspaceId);
    let experiment: Awaited<
      ReturnType<PromptRepository["updateExperimentStatus"]>
    >;
    try {
      experiment = await this.repository.updateExperimentStatus(
        workspaceId,
        promptId,
        experimentId,
        status,
      );
    } catch (error) {
      this.rethrowUniqueConflict(error, "PROMPT_EXPERIMENT_CONFLICT");
    }
    if (!experiment) {
      throw new NotFoundErrorException("PROMPT_EXPERIMENT_NOT_FOUND");
    }
    runtimeConfigService.invalidate(workspaceId);
    return this.toExperiment(experiment);
  }

  /** Prompt 엔티티를 공개 초안 응답으로 변환합니다. */
  private toPrompt(prompt: PromptEntity) {
    return {
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      draftContent: prompt.draftContent ?? "",
      draftRevision: prompt.draftRevision,
      createdAt: prompt.createdAt.toISOString(),
      updatedAt: prompt.updatedAt.toISOString(),
    };
  }

  /** PromptVersion 엔티티를 불변 버전 응답으로 변환합니다. */
  private toVersion(version: PromptVersionEntity) {
    return {
      id: version.id,
      promptId: version.promptId!,
      version: version.version,
      content: version.content,
      contentHash: version.contentHash!,
      baseVersionId: version.baseVersionId,
      changeReason: version.changeReason,
      createdByUserId: version.createdByUserId,
      draftRevision: version.draftRevision,
      createdAt: version.createdAt.toISOString(),
    };
  }

  /** 배포 엔티티와 버전 정보를 외부 응답으로 변환합니다. */
  private toDeployment(
    deployment: PromptDeploymentEntity,
    version: PromptVersionEntity,
  ) {
    return {
      id: deployment.id,
      promptId: deployment.promptId,
      versionId: deployment.versionId,
      version: version.version,
      environment: deployment.environment as "production" | "staging",
      agentId: deployment.agentId,
      active: deployment.active,
      supersedesDeploymentId: deployment.supersedesDeploymentId,
      reason: deployment.reason,
      deployedAt: deployment.deployedAt.toISOString(),
      deployedByUserId: deployment.deployedByUserId,
    };
  }

  /** 실험 엔티티를 공개 트래픽 분배 응답으로 변환합니다. */
  private toExperiment(experiment: PromptExperimentEntity) {
    return {
      id: experiment.id,
      promptId: experiment.promptId,
      name: experiment.name,
      environment: experiment.environment as "production" | "staging",
      agentId: experiment.agentId,
      variants: experiment.variants,
      status: experiment.status,
      createdAt: experiment.createdAt.toISOString(),
      startedAt: experiment.startedAt?.toISOString() ?? null,
      endedAt: experiment.endedAt?.toISOString() ?? null,
    };
  }

  /** 삭제되지 않은 프롬프트를 찾거나 404를 반환합니다. */
  private async findPrompt(workspaceId: string, promptId: string) {
    const prompt = await this.repository.find(workspaceId, promptId);
    if (!prompt) throw new NotFoundErrorException("PROMPT_NOT_FOUND");
    return prompt;
  }

  /** 프롬프트에 속한 버전을 찾거나 404를 반환합니다. */
  private async findVersion(
    workspaceId: string,
    promptId: string,
    versionId: string,
  ) {
    const version = await this.repository.findVersion(
      workspaceId,
      promptId,
      versionId,
    );
    if (!version) {
      throw new NotFoundErrorException("PROMPT_VERSION_NOT_FOUND");
    }
    return version;
  }

  /** PostgreSQL unique 위반을 명확한 409 오류로 변환합니다. */
  private rethrowUniqueConflict(error: unknown, message: string): never {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConflictErrorException(message);
    }
    throw error;
  }

  /** 프롬프트 조회 권한을 확인합니다. */
  private assertRead(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
  }

  /** 프롬프트 변경 권한을 확인합니다. */
  private assertWrite(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_UPDATE,
    });
  }
}

export const promptService = new PromptService();
