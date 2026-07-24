import { API_KEY_SCOPES } from "@repo/constants";
import { openAPIContract } from "@repo/contract";
import { Hono } from "hono";
import { createWorkspaceApiKeyMiddleware } from "../../../common/middleware/workspace-api-key.middleware.js";
import { openApiRateLimitMiddleware } from "../../../common/middleware/openapi-rate-limit.middleware.js";
import type { AppEnv } from "../../../common/types/app-env.js";
import { createRuntimeConfigHandlers } from "./runtime-config.handler.js";

const handlers = createRuntimeConfigHandlers();

/** SDK 전용 런타임 설정 조회 라우터입니다. */
export const runtimeConfigRouter = new Hono<AppEnv>();

// 프롬프트와 정책을 함께 반환하므로 두 읽기 권한을 모두 요구합니다.
runtimeConfigRouter.on(
  openAPIContract.getRuntimeConfig.method,
  openAPIContract.getRuntimeConfig.path,
  createWorkspaceApiKeyMiddleware([
    API_KEY_SCOPES.CONFIG_READ,
    API_KEY_SCOPES.POLICIES_READ,
  ]),
  openApiRateLimitMiddleware,
  ...handlers.get,
);
