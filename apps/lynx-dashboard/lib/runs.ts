import { workspaceContract } from "@repo/contract";
import type {
  RunDetailResponseDto,
  RunListQueryDto,
  RunListResponseDto,
} from "@repo/dto";
import { getJson } from "./api";

/** 현재 사용자가 접근 가능한 워크스페이스의 Run 목록을 조회합니다. */
export async function listWorkspaceRuns(
  workspaceId: string,
  query: RunListQueryDto = {},
): Promise<RunListResponseDto> {
  const path = workspaceContract.listRuns.path.replace(
    ":workspaceId",
    encodeURIComponent(workspaceId),
  );
  const response = await getJson<unknown>(path, query);
  return workspaceContract.listRuns.response.parse(response);
}

/** Run 상세와 시간순 Event 타임라인을 조회합니다. */
export async function getWorkspaceRun(
  workspaceId: string,
  runId: string,
): Promise<RunDetailResponseDto> {
  const path = workspaceContract.getRun.path
    .replace(":workspaceId", encodeURIComponent(workspaceId))
    .replace(":runId", encodeURIComponent(runId));
  const response = await getJson<unknown>(path);
  return workspaceContract.getRun.response.parse(response);
}
