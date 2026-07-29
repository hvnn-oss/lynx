import { issuesContract } from "@repo/contract";
import type {
  CreateIssueCommentDto,
  CreateIssueCommentResponseDto,
  GetIssueActivitiesQueryDto,
  GetIssueActivitiesResponseDto,
  GetIssueAssigneesResponseDto,
  GetIssueEvaluationsQueryDto,
  GetIssueEvaluationsResponseDto,
  GetIssueOccurrencesQueryDto,
  GetIssueOccurrencesResponseDto,
  GetIssueRecordsQueryDto,
  GetIssueRecordsResponseDto,
  GetIssueResponseDto,
  GetIssuesQueryInput,
  GetIssuesResponseDto,
  GetIssuesSummaryQueryDto,
  GetIssuesSummaryResponseDto,
  UpdateIssueStatusDto,
  UpdateIssueStatusResponseDto,
  UpdateIssueAssigneesDto,
  UpdateIssueCommentDto,
  UpdateIssueCommentResponseDto,
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

export type IssueRecordsQuery = Omit<GetIssueRecordsQueryDto, "limit"> & {
  limit?: number;
};

export type IssueActivitiesQuery = Omit<GetIssueActivitiesQueryDto, "limit"> & {
  limit?: number;
};

/** SDK 탐지 record와 서버의 현재 처리 상태를 조회합니다. */
export async function listWorkspaceIssueRecords(
  workspaceId: string,
  query: IssueRecordsQuery = {},
): Promise<GetIssueRecordsResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getIssueRecords,
    params: { workspaceId },
    request: query,
  });
}

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

/** 이슈 현황 화면에 필요한 상태·심각도·발생 집계를 조회합니다. */
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

/** 단일 이슈의 원인 후보와 영향 범위를 조회합니다. */
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

/** 단일 이슈에 묶인 실제 발생 기록을 조회합니다. */
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

/** 단일 이슈를 생성하거나 연결한 서버 판정 기록을 조회합니다. */
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

/** 댓글과 상태·담당자 변경 Activity를 조회합니다. */
export async function listWorkspaceIssueActivities(
  workspaceId: string,
  issueId: string,
  query: IssueActivitiesQuery = {},
): Promise<GetIssueActivitiesResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getActivities,
    params: { workspaceId, issueId },
    request: query,
  });
}

/** 이슈 상세에 사용자 댓글을 추가합니다. */
export async function createWorkspaceIssueComment(
  workspaceId: string,
  issueId: string,
  body: CreateIssueCommentDto,
): Promise<CreateIssueCommentResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.createComment,
    params: { workspaceId, issueId },
    request: body,
  });
}

/** 작성자가 자신의 댓글 본문과 멘션을 수정합니다. */
export async function updateWorkspaceIssueComment(
  workspaceId: string,
  issueId: string,
  commentId: string,
  body: UpdateIssueCommentDto,
): Promise<UpdateIssueCommentResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.updateComment,
    params: { workspaceId, issueId, commentId },
    request: body,
  });
}

/** 작성자가 자신의 댓글을 Activity 이력은 보존한 채 삭제합니다. */
export async function deleteWorkspaceIssueComment(
  workspaceId: string,
  issueId: string,
  commentId: string,
): Promise<UpdateIssueCommentResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.deleteComment,
    params: { workspaceId, issueId, commentId },
  });
}

/** 현재 담당자와 선택 가능한 사용자를 조회합니다. */
export async function getWorkspaceIssueAssignees(
  workspaceId: string,
  issueId: string,
): Promise<GetIssueAssigneesResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.getAssignees,
    params: { workspaceId, issueId },
  });
}

/** 이슈 담당자 전체 목록을 변경합니다. */
export async function updateWorkspaceIssueAssignees(
  workspaceId: string,
  issueId: string,
  body: UpdateIssueAssigneesDto,
): Promise<GetIssueAssigneesResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.updateAssignees,
    params: { workspaceId, issueId },
    request: body,
  });
}

/** 이슈 상태를 변경하고 감사 Activity를 함께 기록합니다. */
export async function updateWorkspaceIssueStatus(
  workspaceId: string,
  issueId: string,
  body: UpdateIssueStatusDto,
): Promise<UpdateIssueStatusResponseDto> {
  return requestContract({
    basePath: issuesContract.basePath,
    endpoint: issuesContract.updateStatus,
    params: { workspaceId, issueId },
    request: body,
  });
}
