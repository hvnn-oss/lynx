import {
  CreateWorkspaceSchema,
  CreateWorkspaceApiKeySchema,
  CreatedWorkspaceApiKeySchema,
  ApiKeyIdParamsSchema,
  SuccessResponseSchema,
  WorkspaceApiKeyListResponseSchema,
  WorkspaceIdParamsSchema,
  WorkspaceResponseSchema,
  WorkspaceListResponseSchema,
  RunListQuerySchema,
  RunListResponseSchema,
  RunParamsSchema,
  RunDetailResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

const WORKSPACE_BASE_PATH = "/workspace" as const;

export const workspaceContract = {
  basePath: WORKSPACE_BASE_PATH,
  list: defineEndpoint({
    method: "GET",
    path: "/list",
    request: null,
    response: WorkspaceListResponseSchema,
  }),
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
  listApiKeys: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/api-keys",
    params: WorkspaceIdParamsSchema,
    request: null,
    response: WorkspaceApiKeyListResponseSchema,
  }),
  revokeApiKey: defineEndpoint({
    method: "DELETE",
    path: "/:workspaceId/api-keys/:apiKeyId",
    params: ApiKeyIdParamsSchema,
    request: null,
    response: SuccessResponseSchema,
  }),
  deleteApiKey: defineEndpoint({
    method: "DELETE",
    path: "/:workspaceId/api-keys/:apiKeyId/permanent",
    params: ApiKeyIdParamsSchema,
    request: null,
    response: SuccessResponseSchema,
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
    request: null,
    response: RunDetailResponseSchema,
  }),
};
