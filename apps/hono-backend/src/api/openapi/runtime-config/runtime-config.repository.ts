import { GuardrailPolicyEntity, PromptEntity } from "@repo/database";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";

/** SDK에 배포할 프롬프트와 정책을 워크스페이스 경계 안에서 조회합니다. */
export class RuntimeConfigRepository {
  /** 워크스페이스에 속한 프롬프트와 각 프롬프트의 현재 버전을 조회합니다. */
  listPrompts(workspaceId: string) {
    return AppDataSource.getRepository(PromptEntity)
      .createQueryBuilder("prompt")
      .innerJoinAndSelect("prompt.version", "version")
      .innerJoin("version.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .orderBy("prompt.id", "ASC")
      .getMany();
  }

  /** 워크스페이스에서 활성화된 가드레일 정책만 조회합니다. */
  listPolicies(workspaceId: string) {
    return AppDataSource.getRepository(GuardrailPolicyEntity)
      .createQueryBuilder("policy")
      .innerJoin("policy.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .andWhere("policy.activated = true")
      .orderBy("policy.id", "ASC")
      .getMany();
  }
}

/** 런타임 설정 조회에 사용하는 기본 저장소 인스턴스입니다. */
export const runtimeConfigRepository = new RuntimeConfigRepository();
