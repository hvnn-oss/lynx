import { authContract } from "@repo/contract";
import { Hono } from "hono";

import type { AppEnv } from "../../common/types/app-env.js";
import { createAuthHandlers } from "./auth.handler.js";
import { authService } from "./auth.service.js";
import { localAuthService } from "./local.service.js";

jest.mock("./auth.service.js", () => ({
  authService: {
    buildCompleteLoginInput: jest.fn(),
    complete: jest.fn(),
    createEmailVerification: jest.fn(),
    getSignupPolicy: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    register: jest.fn(),
    verifyEmail: jest.fn(),
  },
}));

jest.mock("./local.service.js", () => ({
  localAuthService: {
    assertAllowed: jest.fn(),
    generateLoginIdentity: jest.fn(),
  },
}));

const mockedAuthService = jest.mocked(authService);
const mockedLocalAuthService = jest.mocked(localAuthService);

function createAuthApp() {
  const handlers = createAuthHandlers();
  const app = new Hono<AppEnv>();

  app.on(
    authContract.signupPolicy.method,
    authContract.signupPolicy.path,
    ...handlers.signupPolicy,
  );
  app.on(authContract.login.method, authContract.login.path, ...handlers.login);
  app.on(
    authContract.refresh.method,
    authContract.refresh.path,
    ...handlers.refresh,
  );
  app.on(
    authContract.logout.method,
    authContract.logout.path,
    ...handlers.logout,
  );

  return app;
}

describe("auth HTTP handlers", () => {
  beforeEach(() => {
    mockedLocalAuthService.assertAllowed.mockResolvedValue(undefined);
  });

  it("returns the current signup policy without authentication", async () => {
    mockedAuthService.getSignupPolicy.mockReturnValue({
      mode: "INVITE_ONLY",
      requiresInvitation: true,
    });

    const response = await createAuthApp().request(
      authContract.signupPolicy.path,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mode: "INVITE_ONLY",
      requiresInvitation: true,
    });
  });

  it("returns an access token and keeps the refresh token in an HttpOnly cookie", async () => {
    const identity = {
      method: "password" as const,
      issuer: "lynx",
      subject: "account-1",
      email: "user@example.com",
      attributes: {},
      userId: "user-1",
    };
    const completeInput = { identity };
    mockedLocalAuthService.generateLoginIdentity.mockResolvedValue(identity);
    mockedAuthService.buildCompleteLoginInput.mockReturnValue(completeInput);
    mockedAuthService.complete.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });

    const response = await createAuthApp().request(authContract.login.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "USER@example.com",
        password: "password123",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      access_token: "access-token",
    });
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("rid=refresh-token"),
    );
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("HttpOnly"),
    );
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("Path=/"),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedLocalAuthService.assertAllowed).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
    );
    expect(mockedAuthService.complete).toHaveBeenCalledWith(completeInput);
  });

  it("rotates the refresh cookie and returns a new access token", async () => {
    mockedAuthService.refresh.mockResolvedValue({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
    });

    const response = await createAuthApp().request(authContract.refresh.path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "rid=old-refresh-token",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      access_token: "new-access-token",
    });
    expect(mockedAuthService.refresh).toHaveBeenCalledWith("old-refresh-token");
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("rid=new-refresh-token"),
    );
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("Path=/"),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("revokes the refresh session and expires the cookie on logout", async () => {
    mockedAuthService.logout.mockResolvedValue(undefined);

    const response = await createAuthApp().request(authContract.logout.path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "rid=refresh-token",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mockedAuthService.logout).toHaveBeenCalledWith("refresh-token");
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("rid="),
    );
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("Max-Age=0"),
    );
    expect(response.headers.get("set-cookie")).toEqual(
      expect.stringContaining("Path=/"),
    );
  });
});
