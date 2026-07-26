import { workspaceContract } from "@repo/contract";
import type {
  RunDetailResponseDto,
  RunListQueryDto,
  RunListResponseDto,
} from "@repo/dto";
import { requestContract } from "./api";

/** 현재 사용자가 접근 가능한 워크스페이스의 Run 목록을 조회합니다. */
export async function listWorkspaceRuns(
  workspaceId: string,
  query: RunListQueryDto = {},
): Promise<RunListResponseDto> {
  return requestContract({
    basePath: workspaceContract.basePath,
    endpoint: workspaceContract.listRuns,
    params: { workspaceId },
    request: query,
  });
}

/** Run 상세와 시간순 Event 타임라인을 조회합니다. */
export async function getWorkspaceRun(
  workspaceId: string,
  runId: string,
): Promise<RunDetailResponseDto> {
  return requestContract({
    basePath: workspaceContract.basePath,
    endpoint: workspaceContract.getRun,
    params: { workspaceId, runId },
  });
}
