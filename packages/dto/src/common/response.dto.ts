import { z } from "zod";

export const PublicErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  requestId: z.string().min(1),
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const OpenAPIDocumentResponseSchema = z
  .object({
    openapi: z.string().min(1),
    info: z.object({
      title: z.string().min(1),
      version: z.string().min(1),
    }),
    paths: z.record(z.string(), z.unknown()),
  })
  .passthrough();

export type PublicErrorResponseDto = z.infer<
  typeof PublicErrorResponseSchema
>;
export type HealthResponseDto = z.infer<typeof HealthResponseSchema>;
