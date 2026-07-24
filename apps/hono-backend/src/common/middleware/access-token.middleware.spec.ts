import { ERROR_CODES } from "@repo/constants";
import { Hono } from "hono";
import { sign } from "hono/jwt";

import { env } from "../config/config.js";
import type { AppEnv } from "../types/app-env.js";
import { requireAccessToken } from "./access-token.middleware.js";

function createProtectedApp() {
  const app = new Hono<AppEnv>();
  app.get("/protected", requireAccessToken, (c) =>
    c.json({ userId: c.get("currentUserId") }),
  );
  return app;
}

describe("requireAccessToken", () => {
  it("accepts a signed access token and exposes its user id", async () => {
    const token = await sign(
      {
        sub: "user-1",
        sid: "session-1",
        typ: "access",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      env.JWT_SECRET,
      "HS256",
    );

    const response = await createProtectedApp().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: "user-1" });
  });

  it.each([
    ["a missing token", undefined],
    ["a malformed token", "Bearer invalid-token"],
  ])("rejects %s", async (_label, authorization) => {
    const headers = authorization ? { Authorization: authorization } : {};
    const response = await createProtectedApp().request("/protected", {
      headers,
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toContain(ERROR_CODES.TOKEN_EXPIRED);
  });

  it("rejects a valid JWT that is not an access token", async () => {
    const token = await sign(
      {
        sub: "user-1",
        typ: "refresh",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      env.JWT_SECRET,
      "HS256",
    );

    const response = await createProtectedApp().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
  });
});
