import { z } from "zod";

export const DashboardCostResponseSchema = z.object({
  currency: z.literal("USD"),
  metrics: z.object({
    today: z.number().nonnegative(),
    thisWeek: z.number().nonnegative(),
    thisMonth: z.number().nonnegative(),
    averagePerRunThisMonth: z.number().nonnegative(),
    totalTokensThisMonth: z.number().int().nonnegative(),
  }),
  pricingCoverage: z.object({
    catalogVersion: z.string().min(1),
    totalLlmCalls: z.number().int().nonnegative(),
    pricedLlmCalls: z.number().int().nonnegative(),
    unpricedLlmCalls: z.number().int().nonnegative(),
    estimatedLlmCalls: z.number().int().nonnegative(),
    percentage: z.number().min(0).max(100),
  }),
  dailyCost: z
    .array(
      z.object({
        date: z.string().date(),
        cost: z.number().nonnegative(),
      }),
    )
    .max(14),
  topAgents: z
    .array(
      z.object({
        agentId: z.string().uuid(),
        agentName: z.string(),
        cost: z.number().nonnegative(),
        runCount: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative(),
      }),
    )
    .max(8),
});

export type DashboardCostResponseDto = z.infer<
  typeof DashboardCostResponseSchema
>;
