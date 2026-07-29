import { z } from "zod";

export const PublicErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  requestId: z.string().min(1),
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  releaseSha: z.string().min(1),
  deployedAt: z.string().datetime(),
});

export const DependencyHealthSchema = z.object({
  status: z.enum(["up", "down"]),
  latencyMs: z.number().int().nonnegative(),
});

export const ReadinessResponseSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  releaseSha: z.string().min(1),
  deployedAt: z.string().datetime(),
  processRole: z.enum(["api", "worker", "all"]),
  checks: z.object({
    database: DependencyHealthSchema,
    redis: DependencyHealthSchema,
  }),
  operations: z.object({
    status: z.enum(["healthy", "degraded", "unknown"]),
    warnings: z.array(z.string()),
    checkedAt: z.string().datetime(),
  }),
  retentionEnabled: z.boolean(),
  checkedAt: z.string().datetime(),
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

export type PublicErrorResponseDto = z.infer<typeof PublicErrorResponseSchema>;
export type HealthResponseDto = z.infer<typeof HealthResponseSchema>;
export type ReadinessResponseDto = z.infer<typeof ReadinessResponseSchema>;
