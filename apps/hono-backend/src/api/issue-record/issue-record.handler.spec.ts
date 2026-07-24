import { openAPIContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createIssueRecordHandlers } from "./issue-record.handler.js";
import { issueRecordService } from "./issue-record.service.js";

jest.mock("./issue-record.service.js", () => ({
  issueRecordService: {
    receive: jest.fn(),
  },
}));

const mockedService = jest.mocked(issueRecordService);

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createIssueRecordHandlers();
  app.use("*", async (c, next) => {
    c.set("currentWorkspaceId", "workspace-1");
    c.set("currentApiKeyEnvironment", "production");
    await next();
  });
  app.on(
    openAPIContract.createIssueRecord.method,
    openAPIContract.createIssueRecord.path,
    ...handlers.create,
  );
  return app;
}

describe("issue record HTTP handlers", () => {
  it("accepts an immutable record for asynchronous evaluation", async () => {
    mockedService.receive.mockResolvedValue({
      recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
      status: "RECEIVED",
      isNew: true,
    });

    const response = await createApp().request(
      openAPIContract.createIssueRecord.path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdkInstanceId: "sdk-instance-1",
          clientRecordId: "record-1",
          recordKind: "DETECTION",
          detectionType: "LOOP_DETECTED",
          runId: "run-1",
          sessionId: "session-1",
          eventId: "event-1",
          agentId: "agent-1",
          detectedAt: 1784800800000,
          payload: { loopCount: 3 },
        }),
      },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
      status: "RECEIVED",
      isNew: true,
    });
    expect(mockedService.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        environment: "production",
        clientRecordId: "record-1",
      }),
    );
  });
});
