import { z } from "zod";

export const RegisterOrganizationSchema = z.object({
  name: z.string().min(2).max(20),
});

export type RegisterOrganizationDto = z.infer<
  typeof RegisterOrganizationSchema
>;

export const OrganizationResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.literal("OWNER"),
});

export type OrganizationResponseDto = z.infer<
  typeof OrganizationResponseSchema
>;
