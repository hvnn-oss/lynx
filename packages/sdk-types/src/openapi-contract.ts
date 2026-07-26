import { z } from "zod";

const MAX_EVENT_PAYLOAD_BYTES = 256 * 1024;
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1_000;

const EventPayloadSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (payload) =>
      new TextEncoder().encode(JSON.stringify(payload)).byteLength <=
      MAX_EVENT_PAYLOAD_BYTES,
    "Event payload exceeds 256 KiB.",
  );

export const SdkIngestEventSchema = z.object({
  eventId: z.string().min(1).max(160),
  clientId: z.string().min(1).max(120),
  runId: z.string().min(1).max(255),
  agentName: z.string().min(1).max(255),
  eventType: z.string().min(1).max(50),
  label: z.string().min(1).max(255),
  payload: EventPayloadSchema.default({}),
  timestamp: z
    .number()
    .int()
    .positive()
    .refine(
      (timestamp) =>
        timestamp >= Date.now() - MAX_EVENT_AGE_MS &&
        timestamp <= Date.now() + MAX_EVENT_FUTURE_SKEW_MS,
      "Event timestamp is outside the accepted range.",
    ),
  workspaceId: z.string().max(255).optional(),
  agentId: z.string().max(255).optional(),
  sessionId: z.string().max(255).optional(),
  schemaVersion: z.string().max(40).optional(),
});

export const SdkIngestEventBatchSchema = z
  .array(SdkIngestEventSchema)
  .min(1)
  .max(100);

export const SdkIngestEventBatchResponseSchema = z.object({
  success: z.boolean(),
  accepted: z.number().int().nonnegative().default(0),
  retryableEventIds: z.array(z.string()).default([]),
  rejectedEventIds: z.array(z.string()).default([]),
});

export const SdkRuntimeConfigRequestSchema = z.object({});

export const SdkRuntimePromptSchema = z.object({
  promptId: z.string().uuid(),
  name: z.string(),
  versionId: z.string().uuid(),
  version: z.string(),
  content: z.string(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export const SdkRuntimePolicySchema = z.object({
  policyId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.string(),
  condition: z.string(),
  severity: z.string(),
  action: z.string(),
});

export const SdkRuntimeConfigResponseSchema = z.object({
  revision: z.string(),
  prompts: z.array(SdkRuntimePromptSchema),
  policies: z.array(SdkRuntimePolicySchema),
  signing: z
    .object({
      algorithm: z.literal("Ed25519"),
      keyId: z.string(),
      signature: z.string(),
    })
    .nullable()
    .optional(),
});

export const SdkCreateFirewallApprovalSchema = z.object({
  clientRequestId: z.string().min(1).max(160),
  runId: z.string().min(1).max(255),
  sessionId: z.string().min(1).max(255),
  agentId: z.string().min(1).max(255),
  policyId: z.string().max(255).optional(),
  toolName: z.string().min(1).max(255),
  inputHash: z.string().min(1).max(64),
  reason: z.string().max(2_000).optional(),
  timeoutMs: z.number().int().min(1_000).max(24 * 60 * 60 * 1_000),
});

export const SdkFirewallApprovalStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
  expiresAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
  decisionReason: z.string().nullable(),
});

export const SdkCreateIssueRecordSchema = z.object({
  sdkInstanceId: z.string().trim().min(1).max(120),
  clientRecordId: z.string().trim().min(1).max(160),
  recordKind: z.enum(["DETECTION", "RECOVERY"]),
  detectionType: z.string().trim().min(1).max(50),
  runId: z.string().trim().min(1).max(255).optional(),
  sessionId: z.string().trim().min(1).max(255).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  agentId: z.string().trim().min(1).max(255),
  policyId: z.string().trim().min(1).max(255).optional(),
  promptVersionId: z.string().uuid().optional(),
  detectedAt: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()).default({}),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export const SdkIssueRecordAcceptedResponseSchema = z.object({
  recordId: z.string().uuid(),
  status: z.enum(["RECEIVED", "EVALUATING", "DECIDED", "FAILED"]),
  isNew: z.boolean(),
});

export type SdkRuntimeConfigResponse = z.infer<
  typeof SdkRuntimeConfigResponseSchema
>;
export type SdkIngestEventBatchResponse = z.infer<
  typeof SdkIngestEventBatchResponseSchema
>;
export type SdkFirewallApprovalStatusResponse = z.infer<
  typeof SdkFirewallApprovalStatusResponseSchema
>;
export type SdkIssueRecordAcceptedResponse = z.infer<
  typeof SdkIssueRecordAcceptedResponseSchema
>;
