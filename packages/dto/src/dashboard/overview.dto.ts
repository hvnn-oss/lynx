import { ISSUE_SEVERITY } from "@repo/constants";
import { z } from "zod";

export const DashboardOverviewResponseSchema = z.object({
  hasData: z.boolean(),
  kpis: z.object({
    criticalIssues: z.number().int().nonnegative(),
    warningIssues: z.number().int().nonnegative(),
    firewallBlocked: z.number().int().nonnegative(),
    normalThroughputRate: z.number().min(0).max(100),
  }),
  issueTrend: z
    .array(
      z.object({
        date: z.string().date(),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(7),
  importantIssues: z
    .array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        severity: z.enum(ISSUE_SEVERITY),
      }),
    )
    .max(5),
});

export type DashboardOverviewResponseDto = z.infer<
  typeof DashboardOverviewResponseSchema
>;
