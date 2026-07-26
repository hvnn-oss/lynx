import { issuesContract } from "@repo/contract";
import type {
  GetIssueEvaluationsQueryDto,
  GetIssueEvaluationsResponseDto,
  GetIssueOccurrencesQueryDto,
  GetIssueOccurrencesResponseDto,
  GetIssueResponseDto,
  GetIssuesQueryInput,
  GetIssuesResponseDto,
  GetIssuesSummaryQueryDto,
  GetIssuesSummaryResponseDto,
} from "@repo/dto";
import { requestContract } from "./api";

export type IssueOccurrencesQuery = Omit<
  GetIssueOccurrencesQueryDto,
  "limit"
> & {
  limit?: number;
};

export type IssueEvaluationsQuery = Omit<
  GetIssueEvaluationsQueryDto,
  "limit"
> & {
  limit?: number;
};

/** 이슈 목록을 필터와 커서 기준으로 조회합니다. */
export async function listWorkspaceIssues(
  workspaceId: string,
  query: GetIssuesQueryInput = {},
): Promise<GetIssuesResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getIssues,
    params: { workspaceId },
    request: query,
  });
}

/** 이슈 메인 화면에 필요한 집계 정보를 조회합니다. */
export async function getWorkspaceIssuesSummary(
  workspaceId: string,
  query: GetIssuesSummaryQueryDto = {},
): Promise<GetIssuesSummaryResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getSummary,
    params: { workspaceId },
    request: query,
  });
}

/** 단일 이슈의 기본 정보와 누적 수치를 조회합니다. */
export async function getWorkspaceIssue(
  workspaceId: string,
  issueId: string,
): Promise<GetIssueResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getIssue,
    params: { workspaceId, issueId },
  });
}

/** 단일 이슈에 묶인 발생 기록을 조회합니다. */
export async function listWorkspaceIssueOccurrences(
  workspaceId: string,
  issueId: string,
  query: IssueOccurrencesQuery = {},
): Promise<GetIssueOccurrencesResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getOccurrences,
    params: { workspaceId, issueId },
    request: query,
  });
}

/** 단일 이슈를 생성하거나 병합한 판정 기록을 조회합니다. */
export async function listWorkspaceIssueEvaluations(
  workspaceId: string,
  issueId: string,
  query: IssueEvaluationsQuery = {},
): Promise<GetIssueEvaluationsResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getEvaluations,
    params: { workspaceId, issueId },
    request: query,
  });
}

/** 계약에 정의된 이슈 경로에 워크스페이스와 이슈 식별자를 채웁니다. */
