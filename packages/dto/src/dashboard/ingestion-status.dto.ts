import { z } from "zod";

export const INGESTION_HEALTH_STATUS = [
  "HEALTHY",
  "DELAYED",
  "INACTIVE",
  "NO_DATA",
] as const;

export const DashboardIngestionStatusResponseSchema = z.object({
  status: z.enum(INGESTION_HEALTH_STATUS),
  window: z.object({
    hours: z.number().int().positive(),
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  lastStoredAt: z.string().datetime().nullable(),
  metrics: z.object({
    storedEvents: z.number().int().nonnegative(),
    activeRuns: z.number().int().nonnegative(),
    activeAgents: z.number().int().nonnegative(),
    p95StorageDelayMs: z.number().nonnegative().nullable(),
  }),
  hourlyVolume: z
    .array(
      z.object({
        timestamp: z.string().datetime(),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(24),
  sources: z
    .array(
      z.object({
        agentId: z.string().uuid(),
        agentName: z.string(),
        environment: z.string(),
        eventCount: z.number().int().nonnegative(),
        lastStoredAt: z.string().datetime(),
      }),
    )
    .max(8),
  eventTypes: z
    .array(
      z.object({
        eventType: z.string(),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(8),
});

export type IngestionHealthStatus =
  (typeof INGESTION_HEALTH_STATUS)[number];
export type DashboardIngestionStatusResponseDto = z.infer<
  typeof DashboardIngestionStatusResponseSchema
>;
