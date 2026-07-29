import { z } from "zod";
import { SafeRedirectPathSchema } from "./redirect.dto.js";

export const CreateEmailVerificationSchema = z.object({
  email: z.email(),
  invitation_token: z.string().trim().min(32).max(256).optional(),
  team_invitation_code: z.uuid().optional(),
  redirects: SafeRedirectPathSchema.optional(),
});

export type CreateEmailVerificationDto = z.infer<
  typeof CreateEmailVerificationSchema
>;

export const CreateEmailVerificationResponseSchema = z.object({
  success: z.literal(true),
});

export type CreateEmailVerificationResponseDto = z.infer<
  typeof CreateEmailVerificationResponseSchema
>;

export const VerifyEmailTokenSchema = z.object({
  token: z.uuid(),
});

export type VerifyEmailTokenDto = z.infer<typeof VerifyEmailTokenSchema>;

export const VerifyEmailTokenResponseSchema = z.object({
  success: z.literal(true),
  email: z.email(),
  redirects: SafeRedirectPathSchema.nullable(),
  requiresOrganization: z.boolean(),
});

export type VerifyEmailTokenResponseDto = z.infer<
  typeof VerifyEmailTokenResponseSchema
>;
