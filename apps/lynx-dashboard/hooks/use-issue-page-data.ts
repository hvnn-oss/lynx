"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  GetIssuesQueryInput,
  GetIssuesSummaryQueryDto,
} from "@repo/dto";
import {
  getWorkspaceIssue,
  getWorkspaceIssuesSummary,
  listWorkspaceIssueEvaluations,
  listWorkspaceIssueOccurrences,
  listWorkspaceIssues,
  type IssueEvaluationsQuery,
  type IssueOccurrencesQuery,
} from "@/lib/issues";

export const issueQueryKeys = {
  all: ["issues"] as const,
  list: (workspaceId: string, query: GetIssuesQueryInput) =>
    [...issueQueryKeys.all, "list", workspaceId, query] as const,
  summary: (workspaceId: string, query: GetIssuesSummaryQueryDto) =>
    [...issueQueryKeys.all, "summary", workspaceId, query] as const,
  detail: (workspaceId: string, issueId: string) =>
    [...issueQueryKeys.all, "detail", workspaceId, issueId] as const,
  occurrences: (
    workspaceId: string,
    issueId: string,
    query: IssueOccurrencesQuery,
  ) =>
    [
      ...issueQueryKeys.detail(workspaceId, issueId),
      "occurrences",
      query,
    ] as const,
  evaluations: (
    workspaceId: string,
    issueId: string,
    query: IssueEvaluationsQuery,
  ) =>
    [
      ...issueQueryKeys.detail(workspaceId, issueId),
      "evaluations",
      query,
    ] as const,
};

interface UseIssuesPageDataOptions {
  workspaceId?: string | null;
  issuesQuery?: GetIssuesQueryInput;
  summaryQuery?: GetIssuesSummaryQueryDto;
  enabled?: boolean;
}

/** 이슈 메인 페이지의 목록과 요약을 동시에 조회합니다. */
export function useIssuesPageData({
  workspaceId,
  issuesQuery = {},
  summaryQuery = {},
  enabled = true,
}: UseIssuesPageDataOptions) {
  const resolvedWorkspaceId = workspaceId ?? "";
  const isEnabled = enabled && resolvedWorkspaceId.length > 0;

  const issuesResult = useQuery({
    queryKey: issueQueryKeys.list(resolvedWorkspaceId, issuesQuery),
    queryFn: () => listWorkspaceIssues(resolvedWorkspaceId, issuesQuery),
    enabled: isEnabled,
  });
  const summaryResult = useQuery({
    queryKey: issueQueryKeys.summary(resolvedWorkspaceId, summaryQuery),
    queryFn: () =>
      getWorkspaceIssuesSummary(resolvedWorkspaceId, summaryQuery),
    enabled: isEnabled,
  });

  const data =
    issuesResult.data && summaryResult.data
      ? {
          issues: issuesResult.data,
          summary: summaryResult.data,
        }
      : undefined;

  return {
    data,
    isPending:
      isEnabled && (issuesResult.isPending || summaryResult.isPending),
    isFetching: issuesResult.isFetching || summaryResult.isFetching,
    isError: issuesResult.isError || summaryResult.isError,
    error: issuesResult.error ?? summaryResult.error,
    refetch: async () =>
      Promise.all([issuesResult.refetch(), summaryResult.refetch()]),
  };
}

interface UseIssueDetailPageDataOptions {
  workspaceId?: string | null;
  issueId?: string | null;
  occurrencesQuery?: IssueOccurrencesQuery;
  evaluationsQuery?: IssueEvaluationsQuery;
  enabled?: boolean;
}

/**
 * 이슈 상세 페이지의 기본 정보, 발생 기록, 판정 기록을 동시에 조회합니다.
 */
export function useIssueDetailPageData({
  workspaceId,
  issueId,
  occurrencesQuery = {},
  evaluationsQuery = {},
  enabled = true,
}: UseIssueDetailPageDataOptions) {
  const resolvedWorkspaceId = workspaceId ?? "";
  const resolvedIssueId = issueId ?? "";
  const isEnabled =
    enabled &&
    resolvedWorkspaceId.length > 0 &&
    resolvedIssueId.length > 0;

  const issueResult = useQuery({
    queryKey: issueQueryKeys.detail(resolvedWorkspaceId, resolvedIssueId),
    queryFn: () =>
      getWorkspaceIssue(resolvedWorkspaceId, resolvedIssueId),
    enabled: isEnabled,
  });
  const occurrencesResult = useQuery({
    queryKey: issueQueryKeys.occurrences(
      resolvedWorkspaceId,
      resolvedIssueId,
      occurrencesQuery,
    ),
    queryFn: () =>
      listWorkspaceIssueOccurrences(
        resolvedWorkspaceId,
        resolvedIssueId,
        occurrencesQuery,
      ),
    enabled: isEnabled,
  });
  const evaluationsResult = useQuery({
    queryKey: issueQueryKeys.evaluations(
      resolvedWorkspaceId,
      resolvedIssueId,
      evaluationsQuery,
    ),
    queryFn: () =>
      listWorkspaceIssueEvaluations(
        resolvedWorkspaceId,
        resolvedIssueId,
        evaluationsQuery,
      ),
    enabled: isEnabled,
  });

  const data =
    issueResult.data &&
    occurrencesResult.data &&
    evaluationsResult.data
      ? {
          issue: issueResult.data,
          occurrences: occurrencesResult.data,
          evaluations: evaluationsResult.data,
        }
      : undefined;

  return {
    data,
    isPending:
      isEnabled &&
      (issueResult.isPending ||
        occurrencesResult.isPending ||
        evaluationsResult.isPending),
    isFetching:
      issueResult.isFetching ||
      occurrencesResult.isFetching ||
      evaluationsResult.isFetching,
    isError:
      issueResult.isError ||
      occurrencesResult.isError ||
      evaluationsResult.isError,
    error:
      issueResult.error ??
      occurrencesResult.error ??
      evaluationsResult.error,
    refetch: async () =>
      Promise.all([
        issueResult.refetch(),
        occurrencesResult.refetch(),
        evaluationsResult.refetch(),
      ]),
  };
}
