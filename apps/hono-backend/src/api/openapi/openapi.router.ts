import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { API_KEY_SCOPES } from "@repo/constants";
import { openAPIContract } from "@repo/contract";
import type { AppEnv } from "../../common/types/app-env.js";
import { createWorkspaceApiKeyMiddleware } from "../../common/middleware/workspace-api-key.middleware.js";
import { openApiRateLimitMiddleware } from "../../common/middleware/openapi-rate-limit.middleware.js";
import { createOpenAPIEventHandlers } from "./event.handler.js";
import { issueRecordRouter } from "./issue-record/issue-record.router.js";
import { runtimeConfigRouter } from "./runtime-config/runtime-config.router.js";
import { openAPIApprovalRouter } from "./approval/approval.router.js";

/**
 * Public `/openapi/v1` routes used by SDKs and runtime integrations.
 *
 * Each endpoint applies the narrowest API key scope and derives the workspace
 * boundary from the key instead of accepting it from request payloads.
 */
export const openAPIRouter = new Hono<AppEnv>();

const handlers = createOpenAPIEventHandlers();

// Feature routers share the same OpenAPI authentication boundary.
openAPIRouter.route("/", issueRecordRouter);
openAPIRouter.route("/", runtimeConfigRouter);
openAPIRouter.route("/", openAPIApprovalRouter);

// Bound event batches so arbitrary payloads cannot consume unbounded memory.
openAPIRouter.on(
  openAPIContract.ingestEvents.method,
  openAPIContract.ingestEvents.path,
  bodyLimit({ maxSize: 1024 * 1024 }),
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.EVENTS_WRITE]),
  openApiRateLimitMiddleware,
  ...handlers.ingestBatch,
);

/** Run queries require workspace usage read access. */
openAPIRouter.on(
  openAPIContract.listRuns.method,
  openAPIContract.listRuns.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.USAGE_READ]),
  openApiRateLimitMiddleware,
  ...handlers.listRuns,
);

/** Run detail queries require workspace usage read access. */
openAPIRouter.on(
  openAPIContract.getRun.method,
  openAPIContract.getRun.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.USAGE_READ]),
  openApiRateLimitMiddleware,
  ...handlers.getRun,
);

/** Returns one bounded page of events for a run. */
openAPIRouter.on(
  openAPIContract.listRunEvents.method,
  openAPIContract.listRunEvents.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.USAGE_READ]),
  openApiRateLimitMiddleware,
  ...handlers.listRunEvents,
);
