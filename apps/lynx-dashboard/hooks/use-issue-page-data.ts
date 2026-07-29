"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { GetIssuesQueryInput, GetIssuesSummaryQueryDto } from "@repo/dto";
import {
  getWorkspaceIssue,
  getWorkspaceIssueAssignees,
  getWorkspaceIssuesSummary,
  listWorkspaceIssueActivities,
  listWorkspaceIssueEvaluations,
  listWorkspaceIssueOccurrences,
  listWorkspaceIssues,
  type IssueActivitiesQuery,
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
  activities: (
    workspaceId: string,
    issueId: string,
    query: IssueActivitiesQuery,
  ) =>
    [
      ...issueQueryKeys.detail(workspaceId, issueId),
      "activities",
      query,
    ] as const,
  assignees: (workspaceId: string, issueId: string) =>
    [...issueQueryKeys.detail(workspaceId, issueId), "assignees"] as const,
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
    queryFn: () => getWorkspaceIssuesSummary(resolvedWorkspaceId, summaryQuery),
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
    isPending: isEnabled && (issuesResult.isPending || summaryResult.isPending),
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
  activitiesQuery?: IssueActivitiesQuery;
  enabled?: boolean;
}

/**
 * 이슈 상세 정보, 발생·판정·Activity 기록과 담당자를 동시에 조회합니다.
 */
export function useIssueDetailPageData({
  workspaceId,
  issueId,
  occurrencesQuery = {},
  evaluationsQuery = {},
  activitiesQuery = {},
  enabled = true,
}: UseIssueDetailPageDataOptions) {
  const resolvedWorkspaceId = workspaceId ?? "";
  const resolvedIssueId = issueId ?? "";
  const isEnabled =
    enabled && resolvedWorkspaceId.length > 0 && resolvedIssueId.length > 0;

  const issueResult = useQuery({
    queryKey: issueQueryKeys.detail(resolvedWorkspaceId, resolvedIssueId),
    queryFn: () => getWorkspaceIssue(resolvedWorkspaceId, resolvedIssueId),
    enabled: isEnabled,
  });
  const occurrencesResult = useInfiniteQuery({
    queryKey: issueQueryKeys.occurrences(
      resolvedWorkspaceId,
      resolvedIssueId,
      occurrencesQuery,
    ),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      listWorkspaceIssueOccurrences(
        resolvedWorkspaceId,
        resolvedIssueId,
        {
          ...occurrencesQuery,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled,
  });
  const evaluationsResult = useInfiniteQuery({
    queryKey: issueQueryKeys.evaluations(
      resolvedWorkspaceId,
      resolvedIssueId,
      evaluationsQuery,
    ),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      listWorkspaceIssueEvaluations(
        resolvedWorkspaceId,
        resolvedIssueId,
        {
          ...evaluationsQuery,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled,
  });
  const activitiesResult = useInfiniteQuery({
    queryKey: issueQueryKeys.activities(
      resolvedWorkspaceId,
      resolvedIssueId,
      activitiesQuery,
    ),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      listWorkspaceIssueActivities(
        resolvedWorkspaceId,
        resolvedIssueId,
        {
          ...activitiesQuery,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isEnabled,
  });
  const assigneesResult = useQuery({
    queryKey: issueQueryKeys.assignees(resolvedWorkspaceId, resolvedIssueId),
    queryFn: () =>
      getWorkspaceIssueAssignees(resolvedWorkspaceId, resolvedIssueId),
    enabled: isEnabled,
  });

  const data =
    issueResult.data &&
    occurrencesResult.data &&
    evaluationsResult.data &&
    activitiesResult.data &&
    assigneesResult.data
      ? {
          issue: issueResult.data,
          occurrences: {
            items: occurrencesResult.data.pages.flatMap((page) => page.items),
            nextCursor:
              occurrencesResult.data.pages.at(-1)?.nextCursor ?? null,
          },
          evaluations: {
            items: evaluationsResult.data.pages.flatMap((page) => page.items),
            nextCursor:
              evaluationsResult.data.pages.at(-1)?.nextCursor ?? null,
          },
          activities: {
            items: activitiesResult.data.pages.flatMap((page) => page.items),
            nextCursor:
              activitiesResult.data.pages.at(-1)?.nextCursor ?? null,
          },
          assignees: assigneesResult.data,
        }
      : undefined;

  return {
    data,
    isPending:
      isEnabled &&
      (issueResult.isPending ||
        occurrencesResult.isPending ||
        evaluationsResult.isPending ||
        activitiesResult.isPending ||
        assigneesResult.isPending),
    isFetching:
      issueResult.isFetching ||
      occurrencesResult.isFetching ||
      evaluationsResult.isFetching ||
      activitiesResult.isFetching ||
      assigneesResult.isFetching,
    isError:
      issueResult.isError ||
      occurrencesResult.isError ||
      evaluationsResult.isError ||
      activitiesResult.isError ||
      assigneesResult.isError,
    error:
      issueResult.error ??
      occurrencesResult.error ??
      evaluationsResult.error ??
      activitiesResult.error ??
      assigneesResult.error,
    occurrencesPagination: {
      fetchNextPage: occurrencesResult.fetchNextPage,
      hasNextPage: occurrencesResult.hasNextPage,
      isFetchingNextPage: occurrencesResult.isFetchingNextPage,
    },
    evaluationsPagination: {
      fetchNextPage: evaluationsResult.fetchNextPage,
      hasNextPage: evaluationsResult.hasNextPage,
      isFetchingNextPage: evaluationsResult.isFetchingNextPage,
    },
    activitiesPagination: {
      fetchNextPage: activitiesResult.fetchNextPage,
      hasNextPage: activitiesResult.hasNextPage,
      isFetchingNextPage: activitiesResult.isFetchingNextPage,
    },
    refetch: async () =>
      Promise.all([
        issueResult.refetch(),
        occurrencesResult.refetch(),
        evaluationsResult.refetch(),
        activitiesResult.refetch(),
        assigneesResult.refetch(),
      ]),
  };
}
