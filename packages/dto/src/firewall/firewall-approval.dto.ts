import { FIREWALL_APPROVAL_STATUS } from "@repo/constants";
import {
  SdkCreateFirewallApprovalSchema,
  SdkFirewallApprovalStatusResponseSchema,
} from "@repo/sdk-types";
import { z } from "zod";

const LegacyCreateFirewallApprovalSchema = z.object({
  clientRequestId: z.string().min(1).max(160),
  runId: z.string().min(1).max(255),
  sessionId: z.string().min(1).max(255),
  agentId: z.string().min(1).max(255),
  policyId: z.string().max(255).optional(),
  toolName: z.string().min(1).max(255),
  inputHash: z.string().min(1).max(64),
  reason: z.string().max(2_000).optional(),
  timeoutMs: z
    .number()
    .int()
    .min(1_000)
    .max(24 * 60 * 60 * 1_000),
});

export const FirewallApprovalIdParamsSchema = z.object({
  approvalId: z.string().uuid(),
});

export const WorkspaceFirewallApprovalIdParamsSchema =
  FirewallApprovalIdParamsSchema.extend({
    workspaceId: z.string().uuid(),
  });

const LegacyFirewallApprovalStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FIREWALL_APPROVAL_STATUS),
  expiresAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
  decisionReason: z.string().nullable(),
});

export const CreateFirewallApprovalSchema =
  SdkCreateFirewallApprovalSchema;
export const FirewallApprovalStatusResponseSchema =
  SdkFirewallApprovalStatusResponseSchema;

export const FirewallApprovalListQuerySchema = z.object({
  status: z.enum(FIREWALL_APPROVAL_STATUS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const FirewallApprovalListResponseSchema = z.object({
  items: z.array(
    FirewallApprovalStatusResponseSchema.extend({
      policyId: z.string().nullable(),
      toolName: z.string(),
      runId: z.string(),
      sessionId: z.string(),
      agentId: z.string(),
      requestReason: z.string().nullable(),
      requestedAt: z.string().datetime(),
    }),
  ),
});

export const DecideFirewallApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(2_000).optional(),
});

export type CreateFirewallApprovalDto = z.infer<
  typeof CreateFirewallApprovalSchema
>;
export type DecideFirewallApprovalDto = z.infer<
  typeof DecideFirewallApprovalSchema
>;
