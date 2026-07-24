import { z } from "zod";

export const IngestEventSchema = z.object({
  eventId: z.string().min(1).max(160),
  clientId: z.string().min(1).max(120),
  runId: z.string().min(1).max(255),
  agentName: z.string().min(1).max(255),
  eventType: z.string().min(1).max(50),
  label: z.string().min(1).max(255),
  payload: z.record(z.string(), z.unknown()).default({}),
  timestamp: z.number().int().positive(),
  workspaceId: z.string().max(255).optional(),
  agentId: z.string().max(255).optional(),
  sessionId: z.string().max(255).optional(),
  schemaVersion: z.string().max(40).optional(),
});

export const IngestEventBatchSchema = z.array(IngestEventSchema).min(1).max(100);

export const IngestEventBatchResponseSchema = z.object({
  success: z.boolean(),
  accepted: z.number().int().nonnegative(),
  retryableEventIds: z.array(z.string()),
  rejectedEventIds: z.array(z.string()),
});

export const RunListQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  agentId: z.string().uuid().optional(),
  status: z.enum(["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
});

export const RunParamsSchema = z.object({ runId: z.string().min(1).max(255) });

const RunSummarySchema = z.object({
  id: z.string().uuid(),
  runId: z.string(),
  status: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  agent: z.object({ id: z.string().uuid(), name: z.string() }),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
    cost: z.number(),
  }),
});

export const RunListResponseSchema = z.object({
  items: z.array(RunSummarySchema),
  nextCursor: z.string().nullable(),
});

export const RunDetailResponseSchema = RunSummarySchema.extend({
  events: z.array(z.object({
    id: z.string().uuid(),
    eventId: z.string().nullable(),
    eventType: z.string(),
    label: z.string(),
    timestamp: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()),
  })),
});

export type IngestEventDto = z.infer<typeof IngestEventSchema>;
export type RunListQueryDto = z.input<typeof RunListQuerySchema>;
export type RunListResponseDto = z.infer<typeof RunListResponseSchema>;
export type RunDetailResponseDto = z.infer<typeof RunDetailResponseSchema>;
