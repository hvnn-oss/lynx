import { ISSUE_CATEGORY, ISSUE_SEVERITY, ISSUE_STATUS } from "@repo/constants";
import { z } from "zod";

const BooleanQuerySchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const IssueCursorSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i, "Invalid issue cursor.");

const IssueAgentSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1),
  })
  .nullable();

const IssuePolicySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
  })
  .nullable();

const IssuePromptVersionSchema = z
  .object({
    id: z.uuid(),
    version: z.string(),
  })
  .nullable();

const IssueMessageSchema = z
  .object({
    titleKey: z.string().trim().min(1).max(120),
    summaryKey: z.string().trim().min(1).max(120),
    params: z.record(z.string(), z.unknown()),
  })
  .nullable();

/** 이슈 목록 URL query를 검증하고 서비스 입력으로 변환합니다. */
export const GetIssuesQuerySchema = z.object({
  status: z.enum(ISSUE_STATUS).optional(),
  severity: z.enum(ISSUE_SEVERITY).optional(),
  category: z.enum(ISSUE_CATEGORY).optional(),
  agentId: z.uuid().optional(),
  environment: z.string().trim().min(1).max(30).optional(),
  isBlocked: BooleanQuerySchema.optional(),
  cursor: IssueCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const GetIssuesResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      title: z.string().trim().min(1),
      summary: z.string().trim().min(1),
      message: IssueMessageSchema,
      category: z.enum(ISSUE_CATEGORY),
      severity: z.enum(ISSUE_SEVERITY),
      status: z.enum(ISSUE_STATUS),
      environment: z.string().trim().min(1).max(30),
      agent: IssueAgentSchema,
      occurrenceCount: z.number().int().nonnegative(),
      affectedSessionCount: z.number().int().nonnegative(),
      blockedOccurrenceCount: z.number().int().nonnegative(),
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      firstSeenAt: z.string().datetime(),
      lastSeenAt: z.string().datetime(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const IssueIdParamsSchema = z.object({
  workspaceId: z.uuid(),
  issueId: z.uuid(),
});

export const GetIssueResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  summary: z.string(),
  message: IssueMessageSchema,
  category: z.enum(ISSUE_CATEGORY),
  severity: z.enum(ISSUE_SEVERITY),
  status: z.enum(ISSUE_STATUS),
  source: z.string(),
  environment: z.string(),
  reporter: z.object({
    type: z.string(),
    name: z.string(),
  }),
  agent: IssueAgentSchema,
  policy: IssuePolicySchema,
  promptVersion: IssuePromptVersionSchema,
  fingerprint: z.object({
    stable: z.string().regex(/^[0-9a-f]{64}$/),
    exact: z.string().regex(/^[0-9a-f]{64}$/),
    version: z.string(),
  }),
  counts: z.object({
    occurrences: z.number().int().nonnegative(),
    affectedSessions: z.number().int().nonnegative(),
    blockedOccurrences: z.number().int().nonnegative(),
  }),
  riskSignals: z.array(z.string()),
  reproductionSteps: z.array(z.string()),
  tags: z.array(z.string()),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});

export const GetIssueOccurrencesQuerySchema = z.object({
  environment: z.string().trim().min(1).max(30).optional(),
  isBlocked: BooleanQuerySchema.optional(),
  cursor: IssueCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GetIssueOccurrencesResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      detectedAt: z.string().datetime(),
      environment: z.string(),
      isBlocked: z.boolean(),
      session: z.object({
        id: z.uuid(),
        sessionId: z.string().nullable(),
      }),
      run: z
        .object({
          id: z.uuid(),
          runId: z.string(),
        })
        .nullable(),
      event: z
        .object({
          id: z.uuid(),
          eventId: z.string().nullable(),
          eventType: z.string(),
          label: z.string(),
        })
        .nullable(),
      agent: IssueAgentSchema,
      policy: IssuePolicySchema,
      promptVersion: IssuePromptVersionSchema,
      detectorVersion: z.string(),
      evidence: z.record(z.string(), z.unknown()).nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const GetIssueEvaluationsQuerySchema = z.object({
  cursor: IssueCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const GetIssueEvaluationsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      recordId: z.uuid(),
      pipeline: z.enum(["DETECTION", "RESOLUTION"]),
      action: z.string(),
      reasonCode: z.string(),
      summary: z.string(),
      confidence: z.number().nullable(),
      matchedIssueId: z.uuid().nullable(),
      evaluator: z.object({
        name: z.string(),
        version: z.string(),
        ruleSetVersion: z.string(),
      }),
      fingerprint: z
        .object({
          stable: z.string().regex(/^[0-9a-f]{64}$/),
          exact: z.string().regex(/^[0-9a-f]{64}$/),
          version: z.string(),
        })
        .nullable(),
      evidence: z.record(z.string(), z.unknown()),
      createdAt: z.string().datetime(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const UpdateIssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUS),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const UpdateIssueStatusResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(ISSUE_STATUS),
  resolvedAt: z.string().datetime().nullable(),
  resolvedBy: z
    .object({
      id: z.uuid(),
      name: z.string(),
    })
    .nullable(),
  updatedAt: z.string().datetime(),
});

export const GetIssuesSummaryQuerySchema = z
  .object({
    environment: z.string().trim().min(1).max(30).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .refine(
    ({ from, to }) => !from || !to || new Date(from) <= new Date(to),
    "from must be earlier than or equal to to.",
  );

export const GetIssuesSummaryResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  byStatus: z.object({
    open: z.number().int().nonnegative(),
    investigating: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    ignored: z.number().int().nonnegative(),
  }),
  bySeverity: z.object({
    critical: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }),
  newIssues: z.number().int().nonnegative(),
  reopenedIssues: z.number().int().nonnegative(),
  occurrences: z.number().int().nonnegative(),
  blockedOccurrences: z.number().int().nonnegative(),
  affectedSessions: z.number().int().nonnegative(),
});

export type GetIssuesQueryInput = z.input<typeof GetIssuesQuerySchema>;
export type GetIssuesQueryDto = z.output<typeof GetIssuesQuerySchema>;
export type GetIssuesResponseDto = z.infer<typeof GetIssuesResponseSchema>;
export type GetIssueResponseDto = z.infer<typeof GetIssueResponseSchema>;
export type GetIssueOccurrencesQueryDto = z.output<
  typeof GetIssueOccurrencesQuerySchema
>;
export type GetIssueOccurrencesResponseDto = z.infer<
  typeof GetIssueOccurrencesResponseSchema
>;
export type GetIssueEvaluationsQueryDto = z.output<
  typeof GetIssueEvaluationsQuerySchema
>;
export type GetIssueEvaluationsResponseDto = z.infer<
  typeof GetIssueEvaluationsResponseSchema
>;
export type UpdateIssueStatusDto = z.infer<typeof UpdateIssueStatusSchema>;
export type UpdateIssueStatusResponseDto = z.infer<
  typeof UpdateIssueStatusResponseSchema
>;
export type GetIssuesSummaryQueryDto = z.output<
  typeof GetIssuesSummaryQuerySchema
>;
export type GetIssuesSummaryResponseDto = z.infer<
  typeof GetIssuesSummaryResponseSchema
>;
