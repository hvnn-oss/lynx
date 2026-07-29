import { ISSUE_RECORD_KIND, ISSUE_RECORD_STATUS } from "@repo/constants";
import { z } from "zod";

const IssueRecordCursorSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i,
    "Invalid issue record cursor.",
  );

/** 워크스페이스의 Issue Record 처리 목록을 필터링합니다. */
export const GetIssueRecordsQuerySchema = z.object({
  recordKind: z.enum(ISSUE_RECORD_KIND).optional(),
  status: z.enum(ISSUE_RECORD_STATUS).optional(),
  cursor: IssueRecordCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** Issue Record 처리 집계와 최근 항목의 서버 판정 상태를 정의합니다. */
export const GetIssueRecordsResponseSchema = z.object({
  summary: z.object({
    received: z.number().int().nonnegative(),
    evaluating: z.number().int().nonnegative(),
    decided: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    recoveryPending: z.number().int().nonnegative(),
    deferred: z.number().int().nonnegative(),
    delayed: z.number().int().nonnegative(),
    unsupported: z.number().int().nonnegative(),
  }),
  items: z.array(
    z.object({
      id: z.uuid(),
      recordKind: z.enum(ISSUE_RECORD_KIND),
      detectionType: z.string(),
      sdkInstanceId: z.string(),
      clientAgentId: z.string(),
      clientRunId: z.string().nullable(),
      clientSessionId: z.string().nullable(),
      environment: z.string(),
      detectedAt: z.string().datetime(),
      createdAt: z.string().datetime(),
      processing: z.object({
        status: z.enum(ISSUE_RECORD_STATUS),
        attemptCount: z.number().int().nonnegative(),
        lastErrorCode: z.string().nullable(),
        nextEvaluationAt: z.string().datetime().nullable(),
        updatedAt: z.string().datetime(),
        isDelayed: z.boolean(),
      }),
      decision: z
        .object({
          action: z.string(),
          reasonCode: z.string(),
          summary: z.string(),
          confidence: z.number().nullable(),
          matchedIssueId: z.uuid().nullable(),
          createdAt: z.string().datetime(),
        })
        .nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

/** 검증을 마친 Issue Record 처리 목록 query입니다. */
export type GetIssueRecordsQueryDto = z.output<
  typeof GetIssueRecordsQuerySchema
>;
/** Issue Record 처리 현황 API의 공개 응답입니다. */
export type GetIssueRecordsResponseDto = z.infer<
  typeof GetIssueRecordsResponseSchema
>;
