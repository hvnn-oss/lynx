import { z } from "zod";
import { RegisterOrganizationSchema } from "../organization/register.dto.js";

export const SignUpSchema = z.object({
  token: z.uuid(),
  password: z.string().min(8).max(20),
  name: z.string().min(2).max(10),
  organization_info: RegisterOrganizationSchema.optional(),
});

export type SignUpDto = z.infer<typeof SignUpSchema>;

export const SignUpResponseSchema = z.object({
  success: z.literal(true),
});

export type SignUpResponseDto = z.infer<typeof SignUpResponseSchema>;
