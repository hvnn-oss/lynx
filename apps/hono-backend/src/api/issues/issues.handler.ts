import { zValidator } from "@hono/zod-validator";
import { issuesContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { issuesService } from "./issues.service.js";

const factory = createFactory<AppEnv>();

/** 로그인 사용자가 사용하는 이슈 관리 HTTP 핸들러를 생성합니다. */
export function createIssueHandlers() {
  const getIssues = factory.createHandlers(
    zValidator("param", issuesContract.getIssues.params!),
    zValidator("query", issuesContract.getIssues.request),
    async (c) => {
      const response = await issuesService.getIssues({
        userId: c.get("currentUserId"),
        workspaceId: c.req.valid("param").workspaceId,
        query: c.req.valid("query"),
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
    getIssues,
    getSummary,
    getIssue,
    getOccurrences,
    getEvaluations,
    updateStatus,
  };
}
