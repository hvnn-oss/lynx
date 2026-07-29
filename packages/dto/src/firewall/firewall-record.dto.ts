import { FIREWALL_ACTIONS, FIREWALL_SEVERITY } from "@repo/constants";
import { z } from "zod";

export const FirewallRecordListQuerySchema = z.object({
  action: z.enum(FIREWALL_ACTIONS).optional(),
  severity: z.enum(FIREWALL_SEVERITY).optional(),
  agentId: z.string().uuid().optional(),
  toolName: z.string().trim().min(1).max(255).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const FirewallRecordResponseSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(FIREWALL_ACTIONS),
  severity: z.enum(FIREWALL_SEVERITY).nullable(),
  message: z.string().nullable(),
  evidence: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  policy: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  reportedPolicyId: z.string().nullable(),
  toolName: z.string().nullable(),
  agent: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable(),
  runId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  environment: z.string().nullable(),
});

export const FirewallRecordListResponseSchema = z.object({
  items: z.array(FirewallRecordResponseSchema),
  nextCursor: z.string().uuid().nullable(),
});

export type FirewallRecordListQueryDto = z.infer<
  typeof FirewallRecordListQuerySchema
>;
