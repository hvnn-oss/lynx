import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8),
  expectedWorkspaceId: z.string().min(1).optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const LoginResponseSchema = z.object({
  success: z.literal(true),
  access_token: z.string().min(1),
});

export type LoginResponseDto = z.infer<typeof LoginResponseSchema>;

export const RefreshTokenResponseSchema = LoginResponseSchema;

export type RefreshTokenResponseDto = z.infer<
  typeof RefreshTokenResponseSchema
>;

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
});

export type SuccessResponseDto = z.infer<typeof SuccessResponseSchema>;
