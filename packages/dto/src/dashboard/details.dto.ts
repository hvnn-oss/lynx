import { ISSUE_SEVERITY } from "@repo/constants";
import { z } from "zod";

export const DashboardDetailParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

export const DashboardSessionDetailResponseSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  name: z.string(),
  status: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  cost: z.number().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  runCount: z.number().int().positive(),
  issueCount: z.number().int().nonnegative(),
  agent: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  events: z
    .array(
      z.object({
        id: z.string().uuid(),
        eventId: z.string().nullable(),
        eventType: z.string(),
        label: z.string(),
        timestamp: z.string().datetime(),
        latency: z.number().nonnegative().nullable(),
        cost: z.number().nonnegative().nullable(),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
  hasMoreEvents: z.boolean(),
});

export const DashboardAgentDetailResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  defaultModel: z.string(),
  lastRunAt: z.string().datetime().nullable(),
  metrics: z.object({
    runCount: z.number().int().nonnegative(),
    completedRunCount: z.number().int().nonnegative(),
    failedRunCount: z.number().int().nonnegative(),
    totalCost: z.number().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  recentRuns: z
    .array(
      z.object({
        id: z.string().uuid(),
        runId: z.string(),
        status: z.string(),
        startedAt: z.string().datetime(),
        cost: z.number().nonnegative(),
        totalTokens: z.number().int().nonnegative(),
      }),
    )
    .max(8),
  recentIssues: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        severity: z.enum(ISSUE_SEVERITY),
        lastSeenAt: z.string().datetime(),
      }),
    )
    .max(5),
});

export type DashboardSessionDetailResponseDto = z.infer<
  typeof DashboardSessionDetailResponseSchema
>;
export type DashboardAgentDetailResponseDto = z.infer<
  typeof DashboardAgentDetailResponseSchema
>;
