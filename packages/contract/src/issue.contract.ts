import {
  GetIssueEvaluationsQuerySchema,
  GetIssueEvaluationsResponseSchema,
  GetIssueOccurrencesQuerySchema,
  GetIssueOccurrencesResponseSchema,
  GetIssueResponseSchema,
  GetIssuesQuerySchema,
  GetIssuesResponseSchema,
  GetIssuesSummaryQuerySchema,
  GetIssuesSummaryResponseSchema,
  IssueIdParamsSchema,
  UpdateIssueStatusResponseSchema,
  UpdateIssueStatusSchema,
  WorkspaceIdParamsSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const ISSUES_BASE_PATH = "/workspace";

export const issuesContract = {
  basePath: ISSUES_BASE_PATH,
  getIssues: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/issues",
    params: WorkspaceIdParamsSchema,
    request: GetIssuesQuerySchema,
    response: GetIssuesResponseSchema,
  }),
  getSummary: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/issues/summary",
    params: WorkspaceIdParamsSchema,
    request: GetIssuesSummaryQuerySchema,
    response: GetIssuesSummaryResponseSchema,
  }),
  getIssue: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/issues/:issueId",
    params: IssueIdParamsSchema,
    request: null,
    response: GetIssueResponseSchema,
  }),
  getOccurrences: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/issues/:issueId/occurrences",
    params: IssueIdParamsSchema,
    request: GetIssueOccurrencesQuerySchema,
    response: GetIssueOccurrencesResponseSchema,
  }),
  getEvaluations: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/issues/:issueId/evaluations",
    params: IssueIdParamsSchema,
    request: GetIssueEvaluationsQuerySchema,
    response: GetIssueEvaluationsResponseSchema,
  }),
  updateStatus: defineEndpoint({
    method: "PATCH",
    path: "/:workspaceId/issues/:issueId/status",
    params: IssueIdParamsSchema,
    request: UpdateIssueStatusSchema,
    response: UpdateIssueStatusResponseSchema,
  }),
};
