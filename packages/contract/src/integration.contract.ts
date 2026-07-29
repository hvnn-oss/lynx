import {
  SlackDeliveryMutationResponseSchema,
  SlackDeliveryParamsSchema,
  SlackIntegrationParamsSchema,
  SlackIntegrationResponseSchema,
  SuccessResponseSchema,
  UpdateSlackIntegrationSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const INTEGRATION_BASE_PATH = "/workspace";

export const integrationContract = {
  basePath: INTEGRATION_BASE_PATH,
  getSlack: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/integrations/slack",
    params: SlackIntegrationParamsSchema,
    request: null,
    response: SlackIntegrationResponseSchema,
  }),
  updateSlack: defineEndpoint({
    method: "PUT",
    path: "/:workspaceId/integrations/slack",
    params: SlackIntegrationParamsSchema,
    request: UpdateSlackIntegrationSchema,
    response: SlackIntegrationResponseSchema,
  }),
  deleteSlack: defineEndpoint({
    method: "DELETE",
    path: "/:workspaceId/integrations/slack",
    params: SlackIntegrationParamsSchema,
    request: null,
    response: SuccessResponseSchema,
  }),
  testSlack: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/integrations/slack/test",
    params: SlackIntegrationParamsSchema,
    request: null,
    response: SlackDeliveryMutationResponseSchema,
  }),
  retrySlackDelivery: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/integrations/slack/deliveries/:deliveryId/retry",
    params: SlackDeliveryParamsSchema,
    request: null,
    response: SlackDeliveryMutationResponseSchema,
  }),
};
