import { createHash } from "node:crypto";
import type { RuntimeConfigResponseDto } from "@repo/dto";
import {
  RuntimeConfigRepository,
  runtimeConfigRepository,
} from "./runtime-config.repository.js";

/** 저장 모델을 SDK가 소비하는 런타임 설정 번들로 변환합니다. */
export class RuntimeConfigService {
  /** 테스트에서 저장소를 교체할 수 있도록 의존성을 주입받습니다. */
  constructor(
    private readonly repository: RuntimeConfigRepository = runtimeConfigRepository,
  ) {}

  /**
   * 워크스페이스의 현재 프롬프트와 활성 정책을 조회합니다.
   *
   * @param workspaceId API 키로 검증된 워크스페이스 식별자
   * @returns 콘텐츠 무결성 해시와 전체 revision을 포함한 런타임 설정
   */
  async get(workspaceId: string): Promise<RuntimeConfigResponseDto> {
    const [promptEntities, policyEntities] = await Promise.all([
      this.repository.listPrompts(workspaceId),
      this.repository.listPolicies(workspaceId),
    ]);
    const prompts = promptEntities.map((prompt) => ({
      promptId: prompt.id,
      name: prompt.name,
      versionId: prompt.version.id,
      version: prompt.version.version,
      content: prompt.version.content,
      contentHash: this.hash(prompt.version.content),
    }));
    const policies = policyEntities.map((policy) => ({
      policyId: String(policy.id),
      name: policy.name,
      description: policy.description ?? null,
      version: policy.version,
      condition: policy.condition,
      severity: policy.severity,
      action: policy.action,
    }));
    // 정렬된 조회 결과 전체를 해싱해 동일한 설정에는 동일한 revision을 부여합니다.
    const revision = this.hash(JSON.stringify({ prompts, policies }));

    return { revision, prompts, policies };
  }

  /** 문자열의 SHA-256 해시를 소문자 16진수로 반환합니다. */
  private hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}

/** 런타임 설정 요청을 처리하는 기본 서비스 인스턴스입니다. */
export const runtimeConfigService = new RuntimeConfigService();
