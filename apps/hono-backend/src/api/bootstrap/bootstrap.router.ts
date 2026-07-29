import { bootstrapContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createBootstrapHandlers } from "./bootstrap.handler.js";

const handlers = createBootstrapHandlers();

/** 인증된 대시보드 클라이언트가 사용하는 초기화 라우터입니다. */
export const bootstrapRouter = new Hono<AppEnv>();

bootstrapRouter.use("*", requireAccessToken);
bootstrapRouter.on(
  bootstrapContract.get.method,
  bootstrapContract.get.path,
  ...handlers.getDashboardContext,
);
