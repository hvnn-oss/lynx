import { zValidator } from "@hono/zod-validator";
import { issuesContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { resolveIssueLocale } from "../../common/services/issue-message.service.js";
import { issuesService } from "./issues.service.js";

const factory = createFactory<AppEnv>();

/** 로그인 사용자가 사용하는 이슈 관리 HTTP 핸들러를 생성합니다. */
export function createIssueHandlers() {
  const getIssueRecords = factory.createHandlers(
    zValidator("param", issuesContract.getIssueRecords.params!),
    zValidator("query", issuesContract.getIssueRecords.request),
    async (c) => {
      const response = await issuesService.getIssueRecords({
        userId: c.get("currentUserId"),
        workspaceId: c.req.valid("param").workspaceId,
        query: c.req.valid("query"),
      });
      return c.json(issuesContract.getIssueRecords.response.parse(response));
    },
  );

  const getIssues = factory.createHandlers(
    zValidator("param", issuesContract.getIssues.params!),
    zValidator("query", issuesContract.getIssues.request),
    async (c) => {
      const response = await issuesService.getIssues({
        userId: c.get("currentUserId"),
        workspaceId: c.req.valid("param").workspaceId,
        query: c.req.valid("query"),
        locale: resolveIssueLocale(c.req.header("Accept-Language")),
      });
      return c.json(issuesContract.getIssues.response.parse(response));
    },
  );

  const getSummary = factory.createHandlers(
    zValidator("param", issuesContract.getSummary.params!),
    zValidator("query", issuesContract.getSummary.request),
    async (c) => {
      const response = await issuesService.getSummary({
        userId: c.get("currentUserId"),
        workspaceId: c.req.valid("param").workspaceId,
        query: c.req.valid("query"),
      });
      return c.json(issuesContract.getSummary.response.parse(response));
    },
  );

  const getIssue = factory.createHandlers(
    zValidator("param", issuesContract.getIssue.params!),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.getIssue({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        locale: resolveIssueLocale(c.req.header("Accept-Language")),
      });
      return c.json(issuesContract.getIssue.response.parse(response));
    },
  );

  const getOccurrences = factory.createHandlers(
    zValidator("param", issuesContract.getOccurrences.params!),
    zValidator("query", issuesContract.getOccurrences.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.getOccurrences({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        query: c.req.valid("query"),
      });
      return c.json(issuesContract.getOccurrences.response.parse(response));
    },
  );

  const getEvaluations = factory.createHandlers(
    zValidator("param", issuesContract.getEvaluations.params!),
    zValidator("query", issuesContract.getEvaluations.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.getEvaluations({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        query: c.req.valid("query"),
      });
      return c.json(issuesContract.getEvaluations.response.parse(response));
    },
  );

  const getActivities = factory.createHandlers(
    zValidator("param", issuesContract.getActivities.params!),
    zValidator("query", issuesContract.getActivities.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.getActivities({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        query: c.req.valid("query"),
      });
      return c.json(issuesContract.getActivities.response.parse(response));
    },
  );

  const createComment = factory.createHandlers(
    zValidator("param", issuesContract.createComment.params!),
    zValidator("json", issuesContract.createComment.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.createComment({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        body: c.req.valid("json"),
      });
      return c.json(issuesContract.createComment.response.parse(response), 201);
    },
  );

  const updateComment = factory.createHandlers(
    zValidator("param", issuesContract.updateComment.params!),
    zValidator("json", issuesContract.updateComment.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.updateComment({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        commentId: params.commentId,
        body: c.req.valid("json"),
      });
      return c.json(issuesContract.updateComment.response.parse(response));
    },
  );

  const deleteComment = factory.createHandlers(
    zValidator("param", issuesContract.deleteComment.params!),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.deleteComment({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        commentId: params.commentId,
      });
      return c.json(issuesContract.deleteComment.response.parse(response));
    },
  );

  const getAssignees = factory.createHandlers(
    zValidator("param", issuesContract.getAssignees.params!),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.getAssignees({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
      });
      return c.json(issuesContract.getAssignees.response.parse(response));
    },
  );

  const updateAssignees = factory.createHandlers(
    zValidator("param", issuesContract.updateAssignees.params!),
    zValidator("json", issuesContract.updateAssignees.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.updateAssignees({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        body: c.req.valid("json"),
      });
      return c.json(issuesContract.updateAssignees.response.parse(response));
    },
  );

  const updateStatus = factory.createHandlers(
    zValidator("param", issuesContract.updateStatus.params!),
    zValidator("json", issuesContract.updateStatus.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await issuesService.updateStatus({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        issueId: params.issueId,
        body: c.req.valid("json"),
      });
      return c.json(issuesContract.updateStatus.response.parse(response));
    },
  );

  return {
    getIssueRecords,
    getIssues,
    getSummary,
    getIssue,
    getOccurrences,
    getEvaluations,
    getActivities,
    createComment,
    updateComment,
    deleteComment,
    getAssignees,
    updateAssignees,
    updateStatus,
  };
}
