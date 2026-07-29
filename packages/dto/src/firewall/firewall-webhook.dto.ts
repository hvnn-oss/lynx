import { WEBHOOK_DELIVERY_STATUS } from "@repo/constants";
import { z } from "zod";
import { FirewallPolicyIdParamsSchema } from "./firewall-policy.dto.js";

export const WebhookDeliveryIdParamsSchema =
  FirewallPolicyIdParamsSchema.extend({
    deliveryId: z.string().uuid(),
  });

export const WebhookDeliveryListQuerySchema = z.object({
  status: z.enum(WEBHOOK_DELIVERY_STATUS).optional(),
  cursor: z
    .string()
    .max(200)
    .refine((value) => {
      const [createdAt, id, extra] = value.split("|");
      return (
        extra === undefined &&
        !!createdAt &&
        !Number.isNaN(Date.parse(createdAt)) &&
        z.string().uuid().safeParse(id).success
      );
    }, "Invalid webhook delivery cursor.")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const WebhookDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  eventType: z.string().min(1),
  status: z.enum(WEBHOOK_DELIVERY_STATUS),
  destination: z.string().min(1),
  policyRevision: z.number().int().positive().nullable(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  nextAttemptAt: z.string().datetime(),
  lastAttemptAt: z.string().datetime().nullable(),
  responseStatus: z.number().int().nullable(),
  lastError: z.string().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const WebhookDeliveryListResponseSchema = z.object({
  items: z.array(WebhookDeliveryResponseSchema),
  nextCursor: z.string().nullable(),
});

export const WebhookDeliveryMutationResponseSchema = z.object({
  delivery: WebhookDeliveryResponseSchema,
});

export type WebhookDeliveryListQueryDto = z.infer<
  typeof WebhookDeliveryListQuerySchema
>;
export type WebhookDeliveryResponseDto = z.infer<
  typeof WebhookDeliveryResponseSchema
>;
