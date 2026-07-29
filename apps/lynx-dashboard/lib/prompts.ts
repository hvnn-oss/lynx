import { promptContract } from "@repo/contract";
import type {
  CreatePromptDto,
  CreatePromptExperimentDto,
  CreatePromptVersionDto,
  DeployPromptDto,
  PromptDeploymentOperationsQueryInput,
  PromptExperimentOperationsQueryInput,
  PromptListQueryInput,
  UpdatePromptDto,
  UpdatePromptExperimentStatusDto,
} from "@repo/dto";
import { requestContract } from "./api";

/** 검색, 배포 상태 및 커서를 적용해 프롬프트 목록을 조회합니다. */
export function listPrompts(
  workspaceId: string,
  query: PromptListQueryInput = {},
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.list,
    params: { workspaceId },
    request: query,
  });
}

export function getPrompt(workspaceId: string, promptId: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.get,
    params: { workspaceId, promptId },
  });
}

/** 새 프롬프트와 첫 번째 편집 가능한 초안을 생성합니다. */
export function createPrompt(workspaceId: string, input: CreatePromptDto) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.create,
    params: { workspaceId },
    request: input,
  });
}

/** 최신 초안을 revision 충돌 검사를 거쳐 저장합니다. */
export function updatePrompt(
  workspaceId: string,
  promptId: string,
  input: UpdatePromptDto,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.update,
    params: { workspaceId, promptId },
    request: input,
  });
}

/** 배포 및 버전 이력은 보존하고 프롬프트를 목록에서 제거합니다. */
export function deletePrompt(workspaceId: string, promptId: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.delete,
    params: { workspaceId, promptId },
  });
}

export function listPromptVersions(workspaceId: string, promptId: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.listVersions,
    params: { workspaceId, promptId },
  });
}

/** 현재 초안을 수정 불가능한 배포 후보 버전으로 확정합니다. */
export function createPromptVersion(
  workspaceId: string,
  promptId: string,
  input: CreatePromptVersionDto,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.createVersion,
    params: { workspaceId, promptId },
    request: input,
  });
}

export function listPromptDeployments(workspaceId: string, promptId: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.listDeployments,
    params: { workspaceId, promptId },
  });
}

/** 워크스페이스 전체 프롬프트 배포 이력을 조회합니다. */
export function listPromptDeploymentOperations(
  workspaceId: string,
  query: PromptDeploymentOperationsQueryInput = {},
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.listDeploymentOperations,
    params: { workspaceId },
    request: query,
  });
}

/** 불변 버전을 환경과 Agent 범위에 활성 배포합니다. */
export function deployPrompt(
  workspaceId: string,
  promptId: string,
  input: DeployPromptDto,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.deploy,
    params: { workspaceId, promptId },
    request: input,
  });
}

/** 과거 버전을 새 활성 배포로 지정해 롤백 이력을 남깁니다. */
export function rollbackPrompt(
  workspaceId: string,
  promptId: string,
  input: DeployPromptDto,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.rollback,
    params: { workspaceId, promptId },
    request: input,
  });
}

export function listPromptExperiments(workspaceId: string, promptId: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.listExperiments,
    params: { workspaceId, promptId },
  });
}

/** 워크스페이스 전체 A/B 실험과 변형별 성능을 조회합니다. */
export function listPromptExperimentOperations(
  workspaceId: string,
  query: PromptExperimentOperationsQueryInput = {},
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.listExperimentOperations,
    params: { workspaceId },
    request: query,
  });
}

/** 프롬프트 버전별 성공률, 오류율 및 비용을 조회합니다. */
export function getPromptVersionMetrics(
  workspaceId: string,
  promptId: string,
  versionId: string,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.getVersionMetrics,
    params: { workspaceId, promptId, versionId },
    request: {},
  });
}

/** 프롬프트의 전체 버전 성능과 변경 영향 이슈를 일괄 조회합니다. */
export function getPromptVersionPerformance(
  workspaceId: string,
  promptId: string,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.getVersionPerformance,
    params: { workspaceId, promptId },
  });
}

/** 버전별 트래픽 비율을 가진 A/B 실험을 생성합니다. */
export function createPromptExperiment(
  workspaceId: string,
  promptId: string,
  input: CreatePromptExperimentDto,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.createExperiment,
    params: { workspaceId, promptId },
    request: input,
  });
}

/** A/B 실험을 시작, 일시 정지 또는 종료합니다. */
export function updatePromptExperimentStatus(
  workspaceId: string,
  promptId: string,
  experimentId: string,
  input: UpdatePromptExperimentStatusDto,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.updateExperimentStatus,
    params: { workspaceId, promptId, experimentId },
    request: input,
  });
}

/** 프롬프트 운영 상단 지표와 SDK 갱신 안내를 조회합니다. */
export function getPromptOperationsSummary(workspaceId: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.getOperationsSummary,
    params: { workspaceId },
  });
}

/** 전체 또는 특정 Agent 배포에 사용할 Agent 선택지를 조회합니다. */
export function listPromptTargetAgents(workspaceId: string, search?: string) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.listTargetAgents,
    params: { workspaceId },
    request: { search, limit: 100 },
  });
}

export function comparePromptVersions(
  workspaceId: string,
  promptId: string,
  fromVersionId: string,
  toVersionId: string,
) {
  return requestContract({
    basePath: promptContract.basePath,
    endpoint: promptContract.compareVersions,
    params: { workspaceId, promptId },
    request: { fromVersionId, toVersionId },
  });
}
