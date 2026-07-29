import { z } from "zod";

export const PromptEnvironmentSchema = z.enum(["production", "staging"]);

const PromptCursorSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i, "Invalid prompt cursor.");

export const PromptIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  promptId: z.string().uuid(),
});

export const PromptVersionIdParamsSchema = PromptIdParamsSchema.extend({
  versionId: z.string().uuid(),
});

export const PromptExperimentIdParamsSchema = PromptIdParamsSchema.extend({
  experimentId: z.string().uuid(),
});

export const PromptListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  environment: PromptEnvironmentSchema.optional(),
  deployment: z
    .enum(["ALL", "DEPLOYED", "UNDEPLOYED", "DRAFT_CHANGED"])
    .default("ALL"),
  cursor: PromptCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const CreatePromptSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).default(""),
  draftContent: z.string().max(256_000).default(""),
});

export const UpdatePromptSchema = z
  .object({
    expectedDraftRevision: z.number().int().positive(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2_000).optional(),
    draftContent: z.string().max(256_000).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.draftContent !== undefined,
    { message: "At least one prompt field is required." },
  );

export const PromptResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  draftContent: z.string(),
  draftRevision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PromptMutationResponseSchema = z.object({
  prompt: PromptResponseSchema,
});

export const PromptDeleteResponseSchema = z.object({
  deleted: z.literal(true),
});

export const CreatePromptVersionSchema = z.object({
  expectedDraftRevision: z.number().int().positive(),
  version: z.string().trim().min(1).max(40),
  content: z.string().max(256_000),
  baseVersionId: z.string().uuid().nullable().optional(),
  changeReason: z.string().trim().max(4_000).nullable().optional(),
});

export const PromptVersionResponseSchema = z.object({
  id: z.string().uuid(),
  promptId: z.string().uuid(),
  version: z.string(),
  content: z.string(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  baseVersionId: z.string().uuid().nullable(),
  changeReason: z.string().nullable(),
  createdByUserId: z.string().uuid().nullable(),
  draftRevision: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
});

export const PromptVersionListResponseSchema = z.object({
  items: z.array(PromptVersionResponseSchema),
});

export const DeployPromptSchema = z.object({
  versionId: z.string().uuid(),
  environment: PromptEnvironmentSchema,
  agentId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().max(2_000).nullable().optional(),
  expectedDeploymentId: z.string().uuid().nullable().optional(),
});

export const RollbackPromptSchema = DeployPromptSchema;

export const PromptDeploymentResponseSchema = z.object({
  id: z.string().uuid(),
  promptId: z.string().uuid(),
  versionId: z.string().uuid(),
  version: z.string(),
  environment: PromptEnvironmentSchema,
  agentId: z.string().uuid().nullable(),
  active: z.boolean(),
  supersedesDeploymentId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  deployedAt: z.string().datetime(),
  deployedByUserId: z.string().uuid().nullable(),
});

export const PromptDeploymentListResponseSchema = z.object({
  items: z.array(PromptDeploymentResponseSchema),
});

export const PromptListItemResponseSchema = PromptResponseSchema.extend({
  latestVersion: z
    .object({
      id: z.string().uuid(),
      version: z.string(),
      draftRevision: z.number().int().positive().nullable(),
      createdAt: z.string().datetime(),
    })
    .nullable(),
  activeDeployments: z.array(
    PromptDeploymentResponseSchema.pick({
      id: true,
      versionId: true,
      version: true,
      environment: true,
      agentId: true,
      deployedAt: true,
    }).extend({
      agentName: z.string().nullable(),
    }),
  ),
});

export const PromptListResponseSchema = z.object({
  items: z.array(PromptListItemResponseSchema),
  nextCursor: z.string().nullable(),
});

export const PromptDeploymentOperationsQuerySchema = z.object({
  promptId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  environment: PromptEnvironmentSchema.optional(),
  active: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .optional(),
  cursor: PromptCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const PromptDeploymentOperationsResponseSchema = z.object({
  items: z.array(
    PromptDeploymentResponseSchema.extend({
      promptName: z.string(),
      agentName: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const ComparePromptVersionsQuerySchema = z.object({
  fromVersionId: z.string().uuid(),
  toVersionId: z.string().uuid(),
});

export const PromptVersionDiffResponseSchema = z.object({
  fromVersionId: z.string().uuid(),
  toVersionId: z.string().uuid(),
  changes: z.array(
    z.object({
      type: z.enum(["UNCHANGED", "ADDED", "REMOVED"]),
      line: z.string(),
      oldLineNumber: z.number().int().positive().nullable(),
      newLineNumber: z.number().int().positive().nullable(),
    }),
  ),
});

export const PromptVersionMetricsQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .refine(
    (value) =>
      !value.from ||
      !value.to ||
      Date.parse(value.from) <= Date.parse(value.to),
    { message: "Metrics range must start before it ends." },
  );

export const PromptVersionMetricsResponseSchema = z.object({
  versionId: z.string().uuid(),
  runCount: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  totalCost: z.number().nonnegative(),
  averageCost: z.number().nonnegative(),
});

export const PromptVersionPerformanceResponseSchema = z.object({
  items: z.array(
    z.object({
      versionId: z.string().uuid(),
      version: z.string(),
      baseVersionId: z.string().uuid().nullable(),
      createdAt: z.string().datetime(),
      metrics: PromptVersionMetricsResponseSchema.omit({ versionId: true }),
      changeImpactIssueCount: z.number().int().nonnegative(),
    }),
  ),
});

const PromptExperimentVariantSchema = z.object({
  versionId: z.string().uuid(),
  weight: z.number().int().min(1).max(100),
});

export const CreatePromptExperimentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    environment: PromptEnvironmentSchema,
    agentId: z.string().uuid().nullable().optional(),
    variants: z.array(PromptExperimentVariantSchema).min(2).max(10),
    activate: z.boolean().default(false),
  })
  .refine(
    (value) =>
      value.variants.reduce((sum, variant) => sum + variant.weight, 0) === 100,
    { message: "Experiment variant weights must total 100." },
  )
  .refine(
    (value) =>
      new Set(value.variants.map((variant) => variant.versionId)).size ===
      value.variants.length,
    { message: "Experiment variants must use unique prompt versions." },
  );

export const UpdatePromptExperimentStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]),
});

export const PromptExperimentResponseSchema = z.object({
  id: z.string().uuid(),
  promptId: z.string().uuid(),
  name: z.string(),
  environment: PromptEnvironmentSchema,
  agentId: z.string().uuid().nullable(),
  variants: z.array(PromptExperimentVariantSchema),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
});

export const PromptExperimentListResponseSchema = z.object({
  items: z.array(PromptExperimentResponseSchema),
});

export const PromptExperimentOperationsQuerySchema = z.object({
  promptId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  environment: PromptEnvironmentSchema.optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  cursor: PromptCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const PromptExperimentOperationsResponseSchema = z.object({
  items: z.array(
    PromptExperimentResponseSchema.omit({ variants: true }).extend({
      promptName: z.string(),
      agentName: z.string().nullable(),
      variants: z.array(
        PromptExperimentVariantSchema.extend({
          version: z.string(),
          metrics: PromptVersionMetricsResponseSchema.omit({
            versionId: true,
          }),
          changeImpactIssueCount: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const PromptOperationsSummaryResponseSchema = z.object({
  promptCount: z.number().int().nonnegative(),
  versionCount: z.number().int().nonnegative(),
  activeDeploymentCount: z.number().int().nonnegative(),
  activeExperimentCount: z.number().int().nonnegative(),
  changeImpactIssueCount: z.number().int().nonnegative(),
  lastConfigurationChangedAt: z.string().datetime().nullable(),
  sdkConfig: z.object({
    delivery: z.literal("PULL"),
    defaultRefreshIntervalMs: z.number().int().positive(),
    minimumRefreshIntervalMs: z.number().int().positive(),
    serverCacheTtlMs: z.number().int().positive(),
    acknowledgementTracking: z.literal(false),
  }),
});

export const PromptTargetAgentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const PromptTargetAgentsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      clientAgentId: z.string().nullable(),
    }),
  ),
});

export type CreatePromptDto = z.infer<typeof CreatePromptSchema>;
export type UpdatePromptDto = z.infer<typeof UpdatePromptSchema>;
export type CreatePromptVersionDto = z.infer<typeof CreatePromptVersionSchema>;
export type DeployPromptDto = z.infer<typeof DeployPromptSchema>;
export type CreatePromptExperimentDto = z.infer<
  typeof CreatePromptExperimentSchema
>;
export type UpdatePromptExperimentStatusDto = z.infer<
  typeof UpdatePromptExperimentStatusSchema
>;
export type PromptListQueryInput = z.input<typeof PromptListQuerySchema>;
export type PromptListQueryDto = z.output<typeof PromptListQuerySchema>;
export type PromptDeploymentOperationsQueryInput = z.input<
  typeof PromptDeploymentOperationsQuerySchema
>;
export type PromptDeploymentOperationsQueryDto = z.output<
  typeof PromptDeploymentOperationsQuerySchema
>;
export type PromptExperimentOperationsQueryInput = z.input<
  typeof PromptExperimentOperationsQuerySchema
>;
export type PromptExperimentOperationsQueryDto = z.output<
  typeof PromptExperimentOperationsQuerySchema
>;
export type PromptTargetAgentsQueryDto = z.output<
  typeof PromptTargetAgentsQuerySchema
>;
