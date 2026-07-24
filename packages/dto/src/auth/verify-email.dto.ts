import { z } from "zod";

export const CreateEmailVerificationSchema = z.object({
  email: z.email(),
  invited_organization_id: z.uuid().optional(),
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
});

export type VerifyEmailTokenResponseDto = z.infer<
  typeof VerifyEmailTokenResponseSchema
>;
