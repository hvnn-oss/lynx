import { zValidator } from "@hono/zod-validator";
import { dashboardContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { dashboardService } from "./dashboard.service.js";

const factory = createFactory<AppEnv>();

export function createDashboardHandlers() {
  const getOverview = factory.createHandlers(
    zValidator("param", dashboardContract.getOverview.params!),
    async (c) =>
      c.json(
        dashboardContract.getOverview.response.parse(
          await dashboardService.getOverview(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );

  return { getOverview };
}
