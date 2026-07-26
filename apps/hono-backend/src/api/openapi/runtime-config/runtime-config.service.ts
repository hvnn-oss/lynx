import { createHash, sign } from "node:crypto";
import type {
  PromptDeploymentEntity,
  PromptExperimentEntity,
  PromptVersionEntity,
} from "@repo/database";
import type { RuntimeConfigResponseDto } from "@repo/dto";
import {
  RuntimeConfigRepository,
  runtimeConfigRepository,
} from "./runtime-config.repository.js";
import { env } from "../../../common/config/config.js";

const RUNTIME_CONFIG_CACHE_TTL_MS = 30_000;
const MAX_CACHED_TARGETS = 1_000;

/** 런타임 설정을 SDK가 소비하는 서명된 번들로 변환합니다. */
export class RuntimeConfigService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; config: RuntimeConfigResponseDto }
  >();

  /** 테스트에서 저장소를 교체할 수 있도록 의존성을 주입받습니다. */
  constructor(
    private readonly repository: RuntimeConfigRepository = runtimeConfigRepository,
  ) {}

  /**
   * 환경, Agent, SDK 설치 식별자에 맞는 현재 런타임 설정을 조회합니다.
   *
   * @param workspaceId API 키로 검증한 워크스페이스 식별자
   * @param environment API 키에 연결된 실행 환경
   * @param agentId Agent 전용 배포를 선택할 식별자
   * @param clientId A/B 변형을 안정적으로 선택할 SDK 설치 식별자
   * @returns 무결성 해시와 선택된 배포 버전을 포함한 런타임 설정
   */
  async get(
    workspaceId: string,
    environment = "production",
    agentId?: string,
    clientId = "anonymous",
  ): Promise<RuntimeConfigResponseDto> {
    const cacheKey = [workspaceId, environment, agentId ?? "", clientId].join(
      "\0",
    );
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.config;
    if (cached) this.cache.delete(cacheKey);

    const [deployments, experiments, policyEntities] = await Promise.all([
      this.repository.listPromptDeployments(workspaceId, environment, agentId),
      this.repository.listActiveExperiments(workspaceId, environment, agentId),
      this.repository.listPolicies(workspaceId),
    ]);
    const selectedDeployments = this.selectScopedRecords(deployments, agentId);
    const selectedExperiments = this.selectScopedRecords(experiments, agentId);
    const experimentVersionIds = [
      ...new Set(
        selectedExperiments.flatMap((experiment) =>
          experiment.variants.map((variant) => variant.versionId),
        ),
      ),
    ];
    const experimentVersions = await this.repository.listPromptVersions(
      workspaceId,
      experimentVersionIds,
    );
    const versionById = new Map(
      experimentVersions.map((version) => [version.id, version]),
    );
    const experimentByPromptId = new Map(
      selectedExperiments.map((experiment) => [
        experiment.promptId,
        experiment,
      ]),
    );
    const prompts = selectedDeployments.map((deployment) => {
      const experiment = experimentByPromptId.get(deployment.promptId);
      const version = experiment
        ? this.selectExperimentVersion(experiment, versionById, clientId)
        : deployment.version;
      return {
        promptId: deployment.promptId,
        name: deployment.prompt.name,
        versionId: version.id,
        version: version.version,
        content: version.content,
        contentHash: version.contentHash ?? this.hash(version.content),
      };
    });
    const policies = policyEntities.map((revision) => ({
      policyId: String(revision.policy.id),
      name: revision.name,
      description: revision.description,
      version: revision.version,
      condition: revision.condition,
      severity: revision.severity,
      action: revision.action,
    }));
    // 정렬된 전체 결과를 해싱해 같은 대상에는 항상 같은 revision을 부여합니다.
    const revision = this.hash(
      JSON.stringify({
        prompts,
        policies,
        signingKeyId: env.RUNTIME_CONFIG_SIGNING_PRIVATE_KEY
          ? env.RUNTIME_CONFIG_SIGNING_KEY_ID
          : null,
      }),
    );

    const signingPayload = JSON.stringify({ revision, prompts, policies });
    const config: RuntimeConfigResponseDto = {
      revision,
      prompts,
      policies,
      signing: env.RUNTIME_CONFIG_SIGNING_PRIVATE_KEY
        ? {
            algorithm: "Ed25519",
            keyId: env.RUNTIME_CONFIG_SIGNING_KEY_ID,
            signature: sign(
              null,
              Buffer.from(signingPayload, "utf8"),
              env.RUNTIME_CONFIG_SIGNING_PRIVATE_KEY.replace(/\\n/g, "\n"),
            ).toString("base64url"),
          }
        : null,
    };
    if (this.cache.size >= MAX_CACHED_TARGETS) {
      const oldestCacheKey = this.cache.keys().next().value;
      if (typeof oldestCacheKey === "string") this.cache.delete(oldestCacheKey);
    }
    this.cache.set(cacheKey, {
      expiresAt: Date.now() + RUNTIME_CONFIG_CACHE_TTL_MS,
      config,
    });
    return config;
  }

  /** 배포 또는 실험 변경 직후 워크스페이스의 모든 대상별 캐시를 제거합니다. */
  invalidate(workspaceId: string): void {
    const prefix = `${workspaceId}\0`;
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.startsWith(prefix)) this.cache.delete(cacheKey);
    }
  }

  /** Agent 전용 레코드를 공통 레코드보다 우선해 프롬프트별 하나만 선택합니다. */
  private selectScopedRecords<
    T extends { promptId: string; agentId: string | null },
  >(records: T[], agentId?: string): T[] {
    const selected = new Map<string, T>();
    for (const record of records) {
      const current = selected.get(record.promptId);
      if (!current || (agentId && record.agentId === agentId)) {
        selected.set(record.promptId, record);
      }
    }
    return [...selected.values()];
  }

  /** SDK 설치 식별자를 해싱해 실험의 가중치 구간에 안정적으로 배정합니다. */
  private selectExperimentVersion(
    experiment: PromptExperimentEntity,
    versionById: Map<string, PromptVersionEntity>,
    clientId: string,
  ): PromptVersionEntity {
    const bucket =
      Number.parseInt(
        this.hash(`${experiment.assignmentSalt}:${clientId}`).slice(0, 8),
        16,
      ) % 100;
    let upperBound = 0;
    for (const variant of experiment.variants) {
      upperBound += variant.weight;
      if (bucket < upperBound) {
        const version = versionById.get(variant.versionId);
        if (version) return version;
      }
    }
    // 버전 삭제 등 비정상 데이터에도 번들 전체 조회를 실패시키지 않습니다.
    const fallback = experiment.variants
      .map((variant) => versionById.get(variant.versionId))
      .find((version): version is PromptVersionEntity => Boolean(version));
    if (!fallback) {
      throw new Error(
        `Prompt experiment ${experiment.id} has no valid version`,
      );
    }
    return fallback;
  }

  /** 문자열의 SHA-256 해시를 소문자 16진수로 반환합니다. */
  private hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }
}

/** 런타임 설정 요청을 처리하는 기본 서비스 인스턴스입니다. */
export const runtimeConfigService = new RuntimeConfigService();
