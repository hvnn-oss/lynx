import { FIREWALL_ACTIONS, FIREWALL_SEVERITY } from "@repo/constants";
import { z } from "zod";

export const FirewallPolicyScopeSchema = z.object({
  environments: z.array(z.string().trim().min(1).max(80)).max(20),
  agentIds: z.array(z.string().uuid()).max(100),
});

export const FirewallPolicyIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  policyId: z.coerce.number().int().positive(),
});

export const FirewallPolicyRevisionParamsSchema =
  FirewallPolicyIdParamsSchema.extend({
    revision: z.coerce.number().int().positive(),
  });

const FirewallWebhookUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  }, "Webhook URL must use HTTP(S) without embedded credentials.");

const FirewallPolicyFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).nullable().optional(),
    condition: z.string().trim().min(1).max(4_000),
    severity: z.enum(FIREWALL_SEVERITY),
    action: z.enum(FIREWALL_ACTIONS),
    version: z.string().trim().min(1).max(40),
    webhookUrl: FirewallWebhookUrlSchema.nullable().optional(),
  })
  .merge(FirewallPolicyScopeSchema);

export const CreateFirewallPolicySchema = FirewallPolicyFieldsSchema.extend({
  environments: FirewallPolicyScopeSchema.shape.environments.optional(),
  agentIds: FirewallPolicyScopeSchema.shape.agentIds.optional(),
});

export const UpdateFirewallPolicySchema = FirewallPolicyFieldsSchema.partial()
  .omit({ version: true })
  .extend({
    version: z.string().trim().min(1).max(40).optional(),
    expectedDraftRevision: z.number().int().positive(),
  })
  .refine((value) => Object.keys(value).length > 1, {
    message: "At least one policy field is required.",
  });

export const FirewallPolicyResponseSchema = FirewallPolicyFieldsSchema.extend({
  id: z.string(),
  activated: z.boolean(),
  draftRevision: z.number().int().positive(),
  deployedRevision: z.number().int().positive().nullable(),
  isDirty: z.boolean(),
  lastMatchedAt: z.string().datetime().nullable(),
  recentBlockCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const FirewallPolicyDetailResponseSchema = z.object({
  policy: FirewallPolicyResponseSchema,
});

export const FirewallPolicyListResponseSchema = z.object({
  items: z.array(FirewallPolicyResponseSchema),
});

export const FirewallPolicyTargetOptionsResponseSchema = z.object({
  agents: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        clientAgentId: z.string().nullable(),
      }),
    )
    .max(100),
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
  output: z.unknown().optional(),
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
  conditions: z.array(
    z.object({
      expression: z.string(),
      field: z.string(),
      operator: z.string(),
      expected: z.unknown(),
      actual: z.unknown(),
      matched: z.boolean(),
      negated: z.boolean(),
    }),
  ),
});

export const FirewallPolicyRevisionResponseSchema =
  FirewallPolicyFieldsSchema.extend({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    isDeployed: z.boolean(),
    createdAt: z.string().datetime(),
    deployedAt: z.string().datetime().nullable(),
  });

export const FirewallPolicyRevisionListResponseSchema = z.object({
  items: z.array(FirewallPolicyRevisionResponseSchema),
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
export type FirewallPolicyRevisionResponseDto = z.infer<
  typeof FirewallPolicyRevisionResponseSchema
>;
export type SimulateFirewallPolicyDto = z.infer<
  typeof SimulateFirewallPolicySchema
>;
