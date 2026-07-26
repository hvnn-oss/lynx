import {
  DashboardOverviewResponseSchema,
  WorkspaceIdParamsSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const dashboardContract = {
  basePath: "/workspace",
  getOverview: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/dashboard/overview",
    params: WorkspaceIdParamsSchema,
    request: null,
    response: DashboardOverviewResponseSchema,
  }),
};
