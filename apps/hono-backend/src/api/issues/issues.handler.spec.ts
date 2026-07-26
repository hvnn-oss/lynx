import { issuesContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createIssueHandlers } from "./issues.handler.js";
import { issuesService } from "./issues.service.js";

jest.mock("./issues.service.js", () => ({
  issuesService: {
    getIssues: jest.fn(),
    getIssue: jest.fn(),
    getOccurrences: jest.fn(),
    getEvaluations: jest.fn(),
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
  return app;
}

describe("issues HTTP handlers", () => {
  it("validates URL query values and forwards the workspace context", async () => {
    mockedService.getIssues.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const response = await createApp().request(
      "/00000000-0000-4000-8000-000000000001/issues?isBlocked=false&limit=10",
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
});
