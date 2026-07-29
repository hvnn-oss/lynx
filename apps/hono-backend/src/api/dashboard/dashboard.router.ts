import { dashboardContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createDashboardHandlers } from "./dashboard.handler.js";

const handlers = createDashboardHandlers();

export const dashboardRouter = new Hono<AppEnv>();

dashboardRouter.use("*", requireAccessToken);
dashboardRouter.use("*", requireProductAccess);
dashboardRouter.on(
  dashboardContract.getOverview.method,
  dashboardContract.getOverview.path,
  ...handlers.getOverview,
);
dashboardRouter.on(
  dashboardContract.getIngestionStatus.method,
  dashboardContract.getIngestionStatus.path,
  ...handlers.getIngestionStatus,
);
dashboardRouter.on(
  dashboardContract.getCost.method,
  dashboardContract.getCost.path,
  ...handlers.getCost,
);
dashboardRouter.on(
  dashboardContract.getSessionsOverview.method,
  dashboardContract.getSessionsOverview.path,
  ...handlers.getSessionsOverview,
);
dashboardRouter.on(
  dashboardContract.getSessionsCompleted.method,
  dashboardContract.getSessionsCompleted.path,
  ...handlers.getSessionsCompleted,
);
dashboardRouter.on(
  dashboardContract.getSessionsFailed.method,
  dashboardContract.getSessionsFailed.path,
  ...handlers.getSessionsFailed,
);
dashboardRouter.on(
  dashboardContract.getAgentsOverview.method,
  dashboardContract.getAgentsOverview.path,
  ...handlers.getAgentsOverview,
);
dashboardRouter.on(
  dashboardContract.getAgentsActive.method,
  dashboardContract.getAgentsActive.path,
  ...handlers.getAgentsActive,
);
dashboardRouter.on(
  dashboardContract.getAgentsInactive.method,
  dashboardContract.getAgentsInactive.path,
  ...handlers.getAgentsInactive,
);
dashboardRouter.on(
  dashboardContract.getSessionDetail.method,
  dashboardContract.getSessionDetail.path,
  ...handlers.getSessionDetail,
);
dashboardRouter.on(
  dashboardContract.getAgentDetail.method,
  dashboardContract.getAgentDetail.path,
  ...handlers.getAgentDetail,
);
