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

  const getIngestionStatus = factory.createHandlers(
    zValidator("param", dashboardContract.getIngestionStatus.params!),
    async (c) =>
      c.json(
        dashboardContract.getIngestionStatus.response.parse(
          await dashboardService.getIngestionStatus(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );

  const getCost = factory.createHandlers(
    zValidator("param", dashboardContract.getCost.params!),
    async (c) =>
      c.json(
        dashboardContract.getCost.response.parse(
          await dashboardService.getCost(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );

  const getSessionsOverview = factory.createHandlers(
    zValidator("param", dashboardContract.getSessionsOverview.params!),
    async (c) =>
      c.json(
        dashboardContract.getSessionsOverview.response.parse(
          await dashboardService.getSessions(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            "ALL",
          ),
        ),
      ),
  );

  const getSessionsCompleted = factory.createHandlers(
    zValidator("param", dashboardContract.getSessionsCompleted.params!),
    async (c) =>
      c.json(
        dashboardContract.getSessionsCompleted.response.parse(
          await dashboardService.getSessions(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            "COMPLETED",
          ),
        ),
      ),
  );

  const getSessionsFailed = factory.createHandlers(
    zValidator("param", dashboardContract.getSessionsFailed.params!),
    async (c) =>
      c.json(
        dashboardContract.getSessionsFailed.response.parse(
          await dashboardService.getSessions(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            "FAILED",
          ),
        ),
      ),
  );

  const getAgentsOverview = factory.createHandlers(
    zValidator("param", dashboardContract.getAgentsOverview.params!),
    async (c) =>
      c.json(
        dashboardContract.getAgentsOverview.response.parse(
          await dashboardService.getAgents(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            "ALL",
          ),
        ),
      ),
  );

  const getAgentsActive = factory.createHandlers(
    zValidator("param", dashboardContract.getAgentsActive.params!),
    async (c) =>
      c.json(
        dashboardContract.getAgentsActive.response.parse(
          await dashboardService.getAgents(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            "ACTIVE",
          ),
        ),
      ),
  );

  const getAgentsInactive = factory.createHandlers(
    zValidator("param", dashboardContract.getAgentsInactive.params!),
    async (c) =>
      c.json(
        dashboardContract.getAgentsInactive.response.parse(
          await dashboardService.getAgents(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            "INACTIVE",
          ),
        ),
      ),
  );

  const getSessionDetail = factory.createHandlers(
    zValidator("param", dashboardContract.getSessionDetail.params!),
    async (c) =>
      c.json(
        dashboardContract.getSessionDetail.response.parse(
          await dashboardService.getSessionDetail(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            c.req.valid("param").id,
          ),
        ),
      ),
  );

  const getAgentDetail = factory.createHandlers(
    zValidator("param", dashboardContract.getAgentDetail.params!),
    async (c) =>
      c.json(
        dashboardContract.getAgentDetail.response.parse(
          await dashboardService.getAgentDetail(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            c.req.valid("param").id,
          ),
        ),
      ),
  );

  return {
    getOverview,
    getIngestionStatus,
    getCost,
    getSessionsOverview,
    getSessionsCompleted,
    getSessionsFailed,
    getAgentsOverview,
    getAgentsActive,
    getAgentsInactive,
    getSessionDetail,
    getAgentDetail,
  };
}
