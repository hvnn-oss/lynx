import { z } from "zod";

export const DASHBOARD_AGENT_SCOPE = ["ALL", "ACTIVE", "INACTIVE"] as const;

export const DashboardAgentsResponseSchema = z.object({
  scope: z.enum(DASHBOARD_AGENT_SCOPE),
  activeWithinHours: z.number().int().positive(),
  metrics: z.object({
    agentCount: z.number().int().nonnegative(),
    activeCount: z.number().int().nonnegative(),
    inactiveCount: z.number().int().nonnegative(),
    runningRunCount: z.number().int().nonnegative(),
    failedRunCount: z.number().int().nonnegative(),
  }),
  agents: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        defaultModel: z.string(),
        status: z.enum(["ACTIVE", "INACTIVE"]),
        lastRunAt: z.string().datetime().nullable(),
        recentRunCount: z.number().int().nonnegative(),
        runningRunCount: z.number().int().nonnegative(),
        failedRunCount: z.number().int().nonnegative(),
        recentCost: z.number().nonnegative(),
      }),
    )
    .max(8),
  runVolume: z
    .array(
      z.object({
        agentId: z.string().uuid(),
        agentName: z.string(),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(8),
});

export type DashboardAgentScope = (typeof DASHBOARD_AGENT_SCOPE)[number];
export type DashboardAgentsResponseDto = z.infer<
  typeof DashboardAgentsResponseSchema
>;
