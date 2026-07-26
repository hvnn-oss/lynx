import { dashboardContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createDashboardHandlers } from "./dashboard.handler.js";

const handlers = createDashboardHandlers();

export const dashboardRouter = new Hono<AppEnv>();

dashboardRouter.use("*", requireAccessToken);
dashboardRouter.on(
  dashboardContract.getOverview.method,
  dashboardContract.getOverview.path,
  ...handlers.getOverview,
);
