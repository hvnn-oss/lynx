import { profileContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createProfileHandlers } from "./profile.handler.js";

const handlers = createProfileHandlers();

export const profileRouter = new Hono<AppEnv>();

profileRouter.use("*", requireAccessToken);
profileRouter.use("*", requireProductAccess);
profileRouter.on(
  profileContract.get.method,
  profileContract.get.path,
  ...handlers.getProfile,
);
profileRouter.on(
  profileContract.update.method,
  profileContract.update.path,
  ...handlers.updateProfile,
);
profileRouter.on(
  profileContract.changePassword.method,
  profileContract.changePassword.path,
  ...handlers.changePassword,
);
profileRouter.on(
  profileContract.uploadImage.method,
  profileContract.uploadImage.path,
  ...handlers.uploadImage,
);
