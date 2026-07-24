import { workspaceContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createWorkspaceHandlers } from "./workspace.handler.js";
import { workspaceService } from "./workspace.service.js";

jest.mock("./workspace.service.js", () => ({
  workspaceService: {
    createApiKey: jest.fn(),
    createWorkspace: jest.fn(),
  },
}));

const mockedWorkspaceService = jest.mocked(workspaceService);

function createWorkspaceApp() {
  const handlers = createWorkspaceHandlers();
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    workspaceContract.create.method,
    workspaceContract.create.path,
    ...handlers.create,
  );
  app.on(
    workspaceContract.createApiKey.method,
    workspaceContract.createApiKey.path,
    ...handlers.createApiKey,
  );

  return app;
}

describe("workspace HTTP handlers", () => {
  it("creates a workspace for the authenticated user", async () => {
    mockedWorkspaceService.createWorkspace.mockResolvedValue({
      id: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      name: "Production",
      orgId: "70302e18-767c-42d3-9674-80c302475981",
    });

    const response = await createWorkspaceApp().request(
      workspaceContract.create.path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Production",
          orgId: "70302e18-767c-42d3-9674-80c302475981",
        }),
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      name: "Production",
      orgId: "70302e18-767c-42d3-9674-80c302475981",
    });
    expect(mockedWorkspaceService.createWorkspace).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Production",
      orgId: "70302e18-767c-42d3-9674-80c302475981",
    });
  });

  it("creates an API key for the requested workspace", async () => {
    mockedWorkspaceService.createApiKey.mockResolvedValue({
      id: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      key: "lynx_production_key_secret",
      name: "Production ingest",
      workspaceId: "70302e18-767c-42d3-9674-80c302475981",
      scopes: ["events:write"],
      expiresAt: new Date("2026-08-21T00:00:00.000Z"),
    });

    const path = workspaceContract.createApiKey.path.replace(
      ":workspaceId",
      "70302e18-767c-42d3-9674-80c302475981",
    );
    const response = await createWorkspaceApp().request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Production ingest",
        environment: "production",
        expirePeriodDays: 30,
        kind: "INGEST",
        scopes: ["events:write"],
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      key: "lynx_production_key_secret",
      name: "Production ingest",
      workspaceId: "70302e18-767c-42d3-9674-80c302475981",
      scopes: ["events:write"],
      expiresAt: "2026-08-21T00:00:00.000Z",
    });
    expect(mockedWorkspaceService.createApiKey).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "70302e18-767c-42d3-9674-80c302475981",
      name: "Production ingest",
      environment: "production",
      expirePeriodDays: 30,
      kind: "INGEST",
      scopes: ["events:write"],
    });
  });
});
