import { API_KEY_SCOPES } from "@repo/constants";
import { openAPIContract } from "@repo/contract";
import { Hono } from "hono";
import { createWorkspaceApiKeyMiddleware } from "../../../common/middleware/workspace-api-key.middleware.js";
import { openApiRateLimitMiddleware } from "../../../common/middleware/openapi-rate-limit.middleware.js";
import type { AppEnv } from "../../../common/types/app-env.js";
import { createOpenAPIApprovalHandlers } from "./approval.handler.js";

const handlers = createOpenAPIApprovalHandlers();

/** Routes SDK approval creation and status polling. */
export const openAPIApprovalRouter = new Hono<AppEnv>();

openAPIApprovalRouter.on(
  openAPIContract.createFirewallApproval.method,
  openAPIContract.createFirewallApproval.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.EVENTS_WRITE]),
  openApiRateLimitMiddleware,
  ...handlers.create,
);

openAPIApprovalRouter.on(
  openAPIContract.getFirewallApproval.method,
  openAPIContract.getFirewallApproval.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.POLICIES_READ]),
  openApiRateLimitMiddleware,
  ...handlers.get,
);
