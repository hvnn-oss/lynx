import {
  CreateWorkspaceSchema,
  CreateWorkspaceApiKeySchema,
  CreatedWorkspaceApiKeySchema,
  WorkspaceIdParamsSchema,
  WorkspaceResponseSchema,
  RunListQuerySchema,
  RunListResponseSchema,
  RunParamsSchema,
  RunDetailResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

const WORKSPACE_BASE_PATH = "/workspace" as const;

export const workspaceContract = {
  basePath: WORKSPACE_BASE_PATH,
  create: defineEndpoint({
    method: "POST",
    path: "/create",
    request: CreateWorkspaceSchema,
    response: WorkspaceResponseSchema,
  }),
  createApiKey: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/api-keys",
    params: WorkspaceIdParamsSchema,
    request: CreateWorkspaceApiKeySchema,
    response: CreatedWorkspaceApiKeySchema,
  }),
  listRuns: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/runs",
    params: WorkspaceIdParamsSchema,
    request: RunListQuerySchema,
    response: RunListResponseSchema,
  }),
  getRun: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/runs/:runId",
    params: RunParamsSchema.extend(WorkspaceIdParamsSchema.shape),
    request: RunParamsSchema,
    response: RunDetailResponseSchema,
  }),
};
