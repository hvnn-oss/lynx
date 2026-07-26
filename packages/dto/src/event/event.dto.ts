import { z } from "zod";
import {
  SdkIngestEventBatchResponseSchema,
  SdkIngestEventBatchSchema,
  SdkIngestEventSchema,
} from "@repo/sdk-types";

/** 직접 API 호출도 개별 Event payload 상한을 넘지 못하도록 검증합니다. */
export const IngestEventSchema = SdkIngestEventSchema;

export const IngestEventBatchSchema = SdkIngestEventBatchSchema;

export const IngestEventBatchResponseSchema =
  SdkIngestEventBatchResponseSchema;

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

export const RunEventListQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T[^|]+\|\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

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
  events: z
    .array(
      z.object({
        id: z.string().uuid(),
        eventId: z.string().nullable(),
        eventType: z.string(),
        label: z.string(),
        timestamp: z.string().datetime(),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
  hasMoreEvents: z.boolean(),
});

export const RunEventListResponseSchema = z.object({
  items: RunDetailResponseSchema.shape.events,
  nextCursor: z.string().nullable(),
});

export type IngestEventDto = z.infer<typeof IngestEventSchema>;
export type RunListQueryDto = z.input<typeof RunListQuerySchema>;
export type RunListResponseDto = z.infer<typeof RunListResponseSchema>;
export type RunDetailResponseDto = z.infer<typeof RunDetailResponseSchema>;
export type RunEventListQueryDto = z.input<typeof RunEventListQuerySchema>;
export type RunEventListResponseDto = z.infer<
  typeof RunEventListResponseSchema
>;
