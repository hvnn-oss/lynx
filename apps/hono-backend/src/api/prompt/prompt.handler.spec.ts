import { promptContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createPromptHandlers } from "./prompt.handler.js";
import { promptService } from "./prompt.service.js";

jest.mock("./prompt.service.js", () => ({
  promptService: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const mockedService = jest.mocked(promptService);
const workspaceId = "72adbb57-96ad-4d3d-a2dc-8faf071673e5";

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createPromptHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "aa5d1f6b-173e-4b14-a42e-fc7077f8ea90");
    await next();
  });
  app.on(
    promptContract.list.method,
    promptContract.list.path,
    ...handlers.list,
  );
  app.on(
    promptContract.create.method,
    promptContract.create.path,
    ...handlers.create,
  );
  app.on(
    promptContract.update.method,
    promptContract.update.path,
    ...handlers.update,
  );
  return app;
}

describe("prompt HTTP handlers", () => {
  it("applies prompt list query defaults and returns deployment summaries", async () => {
    mockedService.list.mockResolvedValue({
      items: [
        {
          id: "c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
          name: "support-agent",
          description: "",
          draftContent: "Be concise.",
          draftRevision: 1,
          createdAt: "2026-07-25T00:00:00.000Z",
          updatedAt: "2026-07-25T00:00:00.000Z",
          latestVersion: null,
          activeDeployments: [],
        },
      ],
      nextCursor: null,
    });

    const response = await createApp().request(`/${workspaceId}/prompts`);

    expect(response.status).toBe(200);
    expect(mockedService.list).toHaveBeenCalledWith(
      expect.any(String),
      workspaceId,
      expect.objectContaining({ deployment: "ALL", limit: 25 }),
    );
  });

  it("validates and creates a prompt draft", async () => {
    const prompt = {
      id: "c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
      name: "support-agent",
      description: "",
      draftContent: "Be concise.",
      draftRevision: 1,
      createdAt: "2026-07-25T00:00:00.000Z",
      updatedAt: "2026-07-25T00:00:00.000Z",
    };
    mockedService.create.mockResolvedValue({ prompt });

    const response = await createApp().request(`/${workspaceId}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "support-agent",
        draftContent: "Be concise.",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ prompt });
  });

  it("rejects a draft update without an expected revision", async () => {
    const response = await createApp().request(
      `/${workspaceId}/prompts/c1821bc3-bf1e-46ef-b210-b9376a41cd0c`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftContent: "stale update" }),
      },
    );

    expect(response.status).toBe(400);
    expect(mockedService.update).not.toHaveBeenCalled();
  });
});
