import { authContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createAuthHandlers } from "./auth.handler.js";

const authHandlers = createAuthHandlers();

export const authRoute = new Hono<AppEnv>();

authRoute.on(
  authContract.createEmailVerification.method,
  authContract.createEmailVerification.path,
  ...authHandlers.createEmailVerification,
);
authRoute.on(
  authContract.verifyEmailToken.method,
  authContract.verifyEmailToken.path,
  ...authHandlers.verifyEmailToken,
);
authRoute.on(
  authContract.signUp.method,
  authContract.signUp.path,
  ...authHandlers.signUp,
);
authRoute.on(
  authContract.login.method,
  authContract.login.path,
  ...authHandlers.login,
);
authRoute.on(
  authContract.refresh.method,
  authContract.refresh.path,
  ...authHandlers.refresh,
);
authRoute.on(
  authContract.logout.method,
  authContract.logout.path,
  ...authHandlers.logout,
);
