import {
  DEFAULT_SLACK_NOTIFICATION_EVENT_TYPES,
  SLACK_NOTIFICATION_EVENT_TYPE,
  WEBHOOK_DELIVERY_STATUS,
} from "@repo/constants";
import { z } from "zod";
import { WorkspaceIdParamsSchema } from "../workspace/api-key.dto.js";

const SLACK_WEBHOOK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);

export const SlackIncomingWebhookUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    return (
      url.protocol === "https:" &&
      SLACK_WEBHOOK_HOSTS.has(url.hostname.toLowerCase()) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      pathSegments[0] === "services" &&
      pathSegments.length >= 4
    );
  }, "A valid Slack Incoming Webhook URL is required.");

export const SlackIntegrationParamsSchema = WorkspaceIdParamsSchema;

export const SlackDeliveryParamsSchema = WorkspaceIdParamsSchema.extend({
  deliveryId: z.string().uuid(),
});

export const UpdateSlackIntegrationSchema = z.object({
  webhookUrl: SlackIncomingWebhookUrlSchema.optional(),
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  isEnabled: z.boolean(),
  eventTypes: z
    .array(z.enum(SLACK_NOTIFICATION_EVENT_TYPE))
    .max(Object.keys(SLACK_NOTIFICATION_EVENT_TYPE).length)
    .default([...DEFAULT_SLACK_NOTIFICATION_EVENT_TYPES]),
});

export const SlackDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1),
  status: z.enum(WEBHOOK_DELIVERY_STATUS),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  responseStatus: z.number().int().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  deliveredAt: z.string().datetime().nullable(),
});

export const SlackIntegrationResponseSchema = z.object({
  isConfigured: z.boolean(),
  isEnabled: z.boolean(),
  displayName: z.string().nullable(),
  destination: z.string().nullable(),
  eventTypes: z.array(z.enum(SLACK_NOTIFICATION_EVENT_TYPE)),
  updatedAt: z.string().datetime().nullable(),
  deliveries: z.array(SlackDeliveryResponseSchema).max(10),
});

export const SlackDeliveryMutationResponseSchema = z.object({
  delivery: SlackDeliveryResponseSchema,
});

export type UpdateSlackIntegrationDto = z.infer<
  typeof UpdateSlackIntegrationSchema
>;
export type SlackIntegrationResponseDto = z.infer<
  typeof SlackIntegrationResponseSchema
>;
