import { integrationContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createSlackIntegrationHandlers } from "./slack-integration.handler.js";

const handlers = createSlackIntegrationHandlers();

export const slackIntegrationRouter = new Hono<AppEnv>();

slackIntegrationRouter.use("*", requireAccessToken);
slackIntegrationRouter.use("*", requireProductAccess);
slackIntegrationRouter.on(
  integrationContract.getSlack.method,
  integrationContract.getSlack.path,
  ...handlers.get,
);
slackIntegrationRouter.on(
  integrationContract.updateSlack.method,
  integrationContract.updateSlack.path,
  ...handlers.update,
);
slackIntegrationRouter.on(
  integrationContract.deleteSlack.method,
  integrationContract.deleteSlack.path,
  ...handlers.remove,
);
slackIntegrationRouter.on(
  integrationContract.testSlack.method,
  integrationContract.testSlack.path,
  ...handlers.test,
);
slackIntegrationRouter.on(
  integrationContract.retrySlackDelivery.method,
  integrationContract.retrySlackDelivery.path,
  ...handlers.retry,
);
