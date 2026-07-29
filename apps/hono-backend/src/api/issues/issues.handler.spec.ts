import { issuesContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createIssueHandlers } from "./issues.handler.js";
import { issuesService } from "./issues.service.js";

jest.mock("./issues.service.js", () => ({
  issuesService: {
    getIssues: jest.fn(),
    getIssueRecords: jest.fn(),
    getIssue: jest.fn(),
    getOccurrences: jest.fn(),
    getEvaluations: jest.fn(),
    getActivities: jest.fn(),
    createComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
    getAssignees: jest.fn(),
    updateAssignees: jest.fn(),
    getSummary: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

const mockedService = jest.mocked(issuesService);

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createIssueHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    issuesContract.getIssueRecords.method,
    issuesContract.getIssueRecords.path,
    ...handlers.getIssueRecords,
  );
  app.on(
    issuesContract.getIssues.method,
    issuesContract.getIssues.path,
    ...handlers.getIssues,
  );
  app.on(
    issuesContract.getSummary.method,
    issuesContract.getSummary.path,
    ...handlers.getSummary,
  );
  app.on(
    issuesContract.updateStatus.method,
    issuesContract.updateStatus.path,
    ...handlers.updateStatus,
  );
  app.on(
    issuesContract.getActivities.method,
    issuesContract.getActivities.path,
    ...handlers.getActivities,
  );
  app.on(
    issuesContract.createComment.method,
    issuesContract.createComment.path,
    ...handlers.createComment,
  );
  app.on(
    issuesContract.updateComment.method,
    issuesContract.updateComment.path,
    ...handlers.updateComment,
  );
  app.on(
    issuesContract.deleteComment.method,
    issuesContract.deleteComment.path,
    ...handlers.deleteComment,
  );
  app.on(
    issuesContract.updateAssignees.method,
    issuesContract.updateAssignees.path,
    ...handlers.updateAssignees,
  );
  return app;
}

describe("issues HTTP handlers", () => {
  it("validates Issue Record workflow filters", async () => {
    mockedService.getIssueRecords.mockResolvedValue({
      summary: {
        received: 0,
        evaluating: 0,
        decided: 0,
        failed: 0,
        recoveryPending: 0,
        deferred: 0,
        delayed: 0,
        unsupported: 0,
      },
      items: [],
      nextCursor: null,
    });

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issue-records?recordKind=RECOVERY&status=RECEIVED&limit=10",
    );

    expect(response.status).toBe(200);
    expect(mockedService.getIssueRecords).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      query: {
        recordKind: "RECOVERY",
        status: "RECEIVED",
        limit: 10,
      },
    });
  });

  it("validates URL query values and forwards the workspace context", async () => {
    mockedService.getIssues.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issues?isBlocked=false&limit=10",
      { headers: { "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(mockedService.getIssues).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      query: {
        isBlocked: false,
        limit: 10,
      },
      locale: "ko",
    });
  });

  it("keeps the summary path separate from the dynamic issue path", async () => {
    mockedService.getSummary.mockResolvedValue({
      total: 2,
      byStatus: { open: 1, investigating: 0, resolved: 1, ignored: 0 },
      bySeverity: { critical: 1, warning: 1, info: 0 },
      newIssues: 1,
      reopenedIssues: 0,
      occurrences: 4,
      blockedOccurrences: 2,
      affectedSessions: 3,
    });

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issues/summary",
    );

    expect(response.status).toBe(200);
    expect(mockedService.getSummary).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      query: {},
    });
  });

  it("validates and forwards issue status changes", async () => {
    mockedService.updateStatus.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000002",
      status: "RESOLVED",
      resolvedAt: "2026-07-24T05:00:00.000Z",
      resolvedBy: {
        id: "00000000-0000-4000-8000-000000000003",
        name: "Operator",
      },
      updatedAt: "2026-07-24T05:00:00.000Z",
    });

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issues/00000000-0000-4000-8000-000000000002/status",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED", reason: "Fixed" }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "00000000-0000-4000-8000-000000000001",
        issueId: "00000000-0000-4000-8000-000000000002",
        body: { status: "RESOLVED", reason: "Fixed" },
      }),
    );
  });

  it("validates and creates an issue comment", async () => {
    mockedService.createComment.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
      type: "COMMENTED",
      actor: {
        type: "USER",
        userId: "00000000-0000-4000-8000-000000000003",
        name: "Operator",
      },
      body: "The failing call is reproducible.",
      editedAt: null,
      deletedAt: null,
      mentions: [],
      permissions: { canEdit: true, canDelete: true },
      metadata: null,
      createdAt: "2026-07-27T01:00:00.000Z",
    });

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issues/00000000-0000-4000-8000-000000000002/comments",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "The failing call is reproducible." }),
      },
    );

    expect(response.status).toBe(201);
    expect(mockedService.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        body: {
          body: "The failing call is reproducible.",
          mentionedUserIds: [],
        },
      }),
    );
  });

  it("validates mention targets when updating a comment", async () => {
    const commentId = "00000000-0000-4000-8000-000000000004";
    const mentionedUserId = "00000000-0000-4000-8000-000000000005";
    mockedService.updateComment.mockResolvedValue({
      id: commentId,
      type: "COMMENTED",
      actor: {
        type: "USER",
        userId: "00000000-0000-4000-8000-000000000003",
        name: "Operator",
      },
      body: "@Reviewer please verify this.",
      editedAt: "2026-07-27T01:05:00.000Z",
      deletedAt: null,
      mentions: [{ userId: mentionedUserId, name: "Reviewer" }],
      permissions: { canEdit: true, canDelete: true },
      metadata: {
        mentions: [{ userId: mentionedUserId, name: "Reviewer" }],
      },
      createdAt: "2026-07-27T01:00:00.000Z",
    });

    const response = await createApp().request(
      `/00000000-0000-4000-8000-000000000001/issues/00000000-0000-4000-8000-000000000002/comments/${commentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: "@Reviewer please verify this.",
          mentionedUserIds: [mentionedUserId],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId,
        body: {
          body: "@Reviewer please verify this.",
          mentionedUserIds: [mentionedUserId],
        },
      }),
    );
  });

  it("deduplicates and forwards issue assignee changes", async () => {
    mockedService.updateAssignees.mockResolvedValue({
      assignees: [],
      availableUsers: [],
    });
    const assigneeId = "00000000-0000-4000-8000-000000000003";

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issues/00000000-0000-4000-8000-000000000002/assignees",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [assigneeId, assigneeId] }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.updateAssignees).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userIds: [assigneeId] },
      }),
    );
  });
});
