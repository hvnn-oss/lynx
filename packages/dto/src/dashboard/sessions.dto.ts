import { z } from "zod";

export const DASHBOARD_SESSION_SCOPE = ["ALL", "COMPLETED", "FAILED"] as const;

export const DashboardSessionsResponseSchema = z.object({
  scope: z.enum(DASHBOARD_SESSION_SCOPE),
  window: z.object({
    hours: z.number().int().positive(),
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  metrics: z.object({
    sessionCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    runningCount: z.number().int().nonnegative(),
    averageDurationMs: z.number().nonnegative().nullable(),
    averageCost: z.number().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
  }),
  hourlyVolume: z
    .array(
      z.object({
        timestamp: z.string().datetime(),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(24),
  sessions: z
    .array(
      z.object({
        id: z.string().uuid(),
        sessionId: z.string(),
        name: z.string(),
        status: z.string(),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime().nullable(),
        durationMs: z.number().nonnegative().nullable(),
        cost: z.number().nonnegative(),
        runCount: z.number().int().positive(),
        agent: z.object({
          id: z.string().uuid(),
          name: z.string(),
        }),
      }),
    )
    .max(8),
});

export type DashboardSessionScope =
  (typeof DASHBOARD_SESSION_SCOPE)[number];
export type DashboardSessionsResponseDto = z.infer<
  typeof DashboardSessionsResponseSchema
>;
