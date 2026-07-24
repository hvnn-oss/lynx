import { z } from "zod";

export const OrganizationPlanCodeSchema = z.enum([
  "FREE",
  "PRO",
  "ENTERPRISE",
]);

export const OrganizationPlanSchema = z.object({
  id: z.uuid(),
  code: OrganizationPlanCodeSchema,
  name: z.string().min(1),
  maxWorkspaces: z.number().int().positive().nullable(),
  maxMembers: z.number().int().positive().nullable(),
  retentionDays: z.number().int().positive(),
  monthlyEventLimit: z.number().int().positive().nullable(),
  includedLogCount: z.number().int().nonnegative().nullable(),
  logOverageUnitPrice: z.number().nonnegative().nullable(),
  features: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
});

export type OrganizationPlanDto = z.infer<typeof OrganizationPlanSchema>;
