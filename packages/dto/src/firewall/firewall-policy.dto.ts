import { FIREWALL_ACTIONS, FIREWALL_SEVERITY } from "@repo/constants";
import { z } from "zod";

export const FirewallPolicyIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  policyId: z.coerce.number().int().positive(),
});

export const FirewallPolicyRevisionParamsSchema =
  FirewallPolicyIdParamsSchema.extend({
    revision: z.coerce.number().int().positive(),
  });

const FirewallPolicyFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable().optional(),
  condition: z.string().trim().min(1).max(4_000),
  severity: z.enum(FIREWALL_SEVERITY),
  action: z.enum(FIREWALL_ACTIONS),
  version: z.string().trim().min(1).max(40),
  webhookUrl: z.url().max(2_048).nullable().optional(),
});

export const CreateFirewallPolicySchema = FirewallPolicyFieldsSchema;

export const UpdateFirewallPolicySchema = FirewallPolicyFieldsSchema.partial()
  .omit({ version: true })
  .extend({ version: z.string().trim().min(1).max(40).optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one policy field is required.",
  });

export const FirewallPolicyResponseSchema = FirewallPolicyFieldsSchema.extend(
  {
    id: z.string(),
    activated: z.boolean(),
    draftRevision: z.number().int().positive(),
    deployedRevision: z.number().int().positive().nullable(),
    isDirty: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  },
);

export const FirewallPolicyListResponseSchema = z.object({
  items: z.array(FirewallPolicyResponseSchema),
});

export const FirewallPolicyMutationResponseSchema = z.object({
  policy: FirewallPolicyResponseSchema,
});

export const FirewallPolicyDeleteResponseSchema = z.object({
  deleted: z.literal(true),
});

export const SimulateFirewallPolicySchema = z.object({
  tool: z.object({
    name: z.string().trim().min(1).max(255),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    sideEffect: z.boolean().optional(),
    externalTarget: z.string().max(2_000).optional(),
  }),
  input: z.unknown().optional(),
  state: z
    .object({
      callCount: z.number().int().nonnegative().default(0),
      totalCost: z.number().nonnegative().default(0),
      elapsedMs: z.number().int().nonnegative().default(0),
      loopCount: z.number().int().nonnegative().default(0),
    })
    .optional(),
});

export const SimulateFirewallPolicyResponseSchema = z.object({
  matched: z.boolean(),
  action: z.enum(FIREWALL_ACTIONS),
  severity: z.enum(FIREWALL_SEVERITY),
  policyId: z.string(),
  version: z.string(),
  revision: z.number().int().positive(),
});

export type CreateFirewallPolicyDto = z.infer<
  typeof CreateFirewallPolicySchema
>;
export type UpdateFirewallPolicyDto = z.infer<
  typeof UpdateFirewallPolicySchema
>;
export type FirewallPolicyResponseDto = z.infer<
  typeof FirewallPolicyResponseSchema
>;
export type SimulateFirewallPolicyDto = z.infer<
  typeof SimulateFirewallPolicySchema
>;
