import {
  FirewallPolicyRevisionEntity,
  PromptDeploymentEntity,
  PromptExperimentEntity,
  PromptVersionEntity,
} from "@repo/database";
import { In } from "typeorm";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";

/** SDK에 배포할 프롬프트와 정책을 워크스페이스 경계 안에서 조회합니다. */
export class RuntimeConfigRepository {
  /**
   * 환경과 Agent 범위에 적용되는 활성 프롬프트 배포를 조회합니다.
   *
   * Agent 전용 배포와 공통 배포를 함께 반환하고, 우선순위는 서비스에서
   * 명시적으로 결정합니다.
   */
  listPromptDeployments(
    workspaceId: string,
    environment: string,
    agentId?: string,
  ) {
    const query = AppDataSource.getRepository(PromptDeploymentEntity)
      .createQueryBuilder("deployment")
      .innerJoinAndSelect("deployment.prompt", "prompt")
      .innerJoinAndSelect("deployment.version", "version")
      .where("deployment.workspaceId = :workspaceId", { workspaceId })
      .andWhere("deployment.environment = :environment", { environment })
      .andWhere("deployment.active = true")
      .andWhere("prompt.deletedAt IS NULL");
    if (agentId) {
      query.andWhere(
        "(deployment.agentId = :agentId OR deployment.agentId IS NULL)",
        { agentId },
      );
    } else {
      query.andWhere("deployment.agentId IS NULL");
    }
    return query
      .orderBy("deployment.promptId", "ASC")
      .addOrderBy("deployment.agentId", "DESC", "NULLS LAST")
      .getMany();
  }

  /** 같은 환경과 Agent 범위에서 활성화된 A/B 실험을 조회합니다. */
  listActiveExperiments(
    workspaceId: string,
    environment: string,
    agentId?: string,
  ) {
    const query = AppDataSource.getRepository(PromptExperimentEntity)
      .createQueryBuilder("experiment")
      .where("experiment.workspaceId = :workspaceId", { workspaceId })
      .andWhere("experiment.environment = :environment", { environment })
      .andWhere("experiment.status = 'ACTIVE'");
    if (agentId) {
      query.andWhere(
        "(experiment.agentId = :agentId OR experiment.agentId IS NULL)",
        { agentId },
      );
    } else {
      query.andWhere("experiment.agentId IS NULL");
    }
    return query
      .orderBy("experiment.promptId", "ASC")
      .addOrderBy("experiment.agentId", "DESC", "NULLS LAST")
      .getMany();
  }

  /** A/B 실험에서 참조하는 불변 프롬프트 버전을 한 번에 조회합니다. */
  listPromptVersions(workspaceId: string, versionIds: string[]) {
    if (versionIds.length === 0) return Promise.resolve([]);
    return AppDataSource.getRepository(PromptVersionEntity).find({
      where: {
        id: In(versionIds),
        workspace: { id: workspaceId },
      },
    });
  }

  /** 워크스페이스에서 활성화된 방화벽 정책만 조회합니다. */
  listPolicies(workspaceId: string) {
    return AppDataSource.getRepository(FirewallPolicyRevisionEntity)
      .createQueryBuilder("revision")
      .innerJoinAndSelect("revision.policy", "policy")
      .innerJoin("policy.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .andWhere("policy.activated = true")
      .andWhere("policy.deletedAt IS NULL")
      .andWhere("revision.revision = policy.deployedRevision")
      .orderBy("policy.id", "ASC")
      .getMany();
  }
}

/** 런타임 설정 조회에 사용하는 기본 저장소 인스턴스입니다. */
export const runtimeConfigRepository = new RuntimeConfigRepository();
