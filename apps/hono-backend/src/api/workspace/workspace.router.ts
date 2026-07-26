import { workspaceContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createWorkspaceHandlers } from "./workspace.handler.js";

const workspaceHandlers = createWorkspaceHandlers();

export const workspaceRouter = new Hono<AppEnv>();

// 워크스페이스 API는 인증된 사용자만 호출할 수 있습니다.
workspaceRouter.use("*", requireAccessToken);
workspaceRouter.on(
  workspaceContract.list.method,
  workspaceContract.list.path,
  ...workspaceHandlers.list,
);
workspaceRouter.on(
  workspaceContract.create.method,
  workspaceContract.create.path,
  ...workspaceHandlers.create,
);
workspaceRouter.on(
  workspaceContract.createApiKey.method,
  workspaceContract.createApiKey.path,
  ...workspaceHandlers.createApiKey,
);
workspaceRouter.on(
  workspaceContract.listApiKeys.method,
  workspaceContract.listApiKeys.path,
  ...workspaceHandlers.listApiKeys,
);
workspaceRouter.on(
  workspaceContract.revokeApiKey.method,
  workspaceContract.revokeApiKey.path,
  ...workspaceHandlers.revokeApiKey,
);
workspaceRouter.on(
  workspaceContract.deleteApiKey.method,
  workspaceContract.deleteApiKey.path,
  ...workspaceHandlers.deleteApiKey,
);
workspaceRouter.on(
  workspaceContract.listRuns.method,
  workspaceContract.listRuns.path,
  ...workspaceHandlers.listRuns,
);
workspaceRouter.on(
  workspaceContract.getRun.method,
  workspaceContract.getRun.path,
  ...workspaceHandlers.getRun,
);
