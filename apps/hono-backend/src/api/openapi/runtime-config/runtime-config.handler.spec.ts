import { openAPIContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createRuntimeConfigHandlers } from "./runtime-config.handler.js";
import { runtimeConfigService } from "./runtime-config.service.js";

jest.mock("./runtime-config.service.js", () => ({
  runtimeConfigService: { get: jest.fn() },
}));

const mockedService = jest.mocked(runtimeConfigService);
const bundle = {
  revision: "revision-1",
  prompts: [],
  policies: [],
  signing: null,
};

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createRuntimeConfigHandlers();
  app.use("*", async (c, next) => {
    c.set("currentWorkspaceId", "workspace-1");
    c.set("currentApiKeyEnvironment", "staging");
    await next();
  });
  app.on(
    openAPIContract.getRuntimeConfig.method,
    openAPIContract.getRuntimeConfig.path,
    ...handlers.get,
  );
  return app;
}

describe("runtime config HTTP handlers", () => {
  it("returns the bundle with an ETag", async () => {
    mockedService.get.mockResolvedValue(bundle);

    const response = await createApp().request(
      openAPIContract.getRuntimeConfig.path,
    );

    expect(response.status).toBe(200);
    expect(mockedService.get).toHaveBeenCalledWith(
      "workspace-1",
      "staging",
      undefined,
      "anonymous",
    );
    expect(response.headers.get("etag")).toBe('"revision-1"');
    await expect(response.json()).resolves.toEqual(bundle);
  });

  it("returns 304 when the SDK already has the current revision", async () => {
    mockedService.get.mockResolvedValue(bundle);

    const response = await createApp().request(
      openAPIContract.getRuntimeConfig.path,
      { headers: { "If-None-Match": '"revision-1"' } },
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  it("rejects an invalid SDK agentId before querying runtime config", async () => {
    const response = await createApp().request(
      openAPIContract.getRuntimeConfig.path,
      { headers: { "X-Lynx-Agent-ID": "" } },
    );

    expect(response.status).toBe(400);
    expect(mockedService.get).not.toHaveBeenCalled();
  });
});
