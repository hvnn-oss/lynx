import { API_KEY_SCOPES } from "@repo/constants";
import { Hono } from "hono";
import type { WorkspaceApiKeyAuthService } from "../auth/workspace-api-key-auth.service.js";
import type { AppEnv } from "../types/app-env.js";
import { createWorkspaceApiKeyMiddleware } from "./workspace-api-key.middleware.js";

describe("Workspace API Key middleware", () => {
  it("reads X-API-Key and stores authentication context", async () => {
    const authService = {
      authenticate: jest.fn().mockResolvedValue({
        apiKeyId: "70302e18-767c-42d3-9674-80c302475981",
        workspaceId: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
        environment: "production",
        scopes: [API_KEY_SCOPES.EVENTS_WRITE],
      }),
    } as unknown as WorkspaceApiKeyAuthService;
    const app = new Hono<AppEnv>();
    app.use(
      "*",
      createWorkspaceApiKeyMiddleware(
        [API_KEY_SCOPES.EVENTS_WRITE],
        authService,
      ),
    );
    app.get("/test", (c) =>
      c.json({
        apiKeyId: c.get("currentApiKeyId"),
        workspaceId: c.get("currentWorkspaceId"),
        environment: c.get("currentApiKeyEnvironment"),
        scopes: c.get("currentApiKeyScopes"),
      }),
    );

    const response = await app.request("/test", {
      headers: { "X-API-Key": "workspace-key" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      apiKeyId: "70302e18-767c-42d3-9674-80c302475981",
      workspaceId: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      environment: "production",
      scopes: [API_KEY_SCOPES.EVENTS_WRITE],
    });
    expect(authService.authenticate).toHaveBeenCalledWith("workspace-key", [
      API_KEY_SCOPES.EVENTS_WRITE,
    ]);
  });

  it("rejects requests without X-API-Key", async () => {
    const authService = {
      authenticate: jest.fn(),
    } as unknown as WorkspaceApiKeyAuthService;
    const app = new Hono<AppEnv>();
    app.use("*", createWorkspaceApiKeyMiddleware([], authService));
    app.get("/test", (c) => c.text("ok"));

    const response = await app.request("/test");

    expect(response.status).toBe(401);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });
});
