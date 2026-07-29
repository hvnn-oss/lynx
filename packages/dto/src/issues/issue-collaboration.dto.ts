import {
  ISSUE_ACTIVITY_TYPE,
  ISSUE_ACTOR_TYPE,
  USER_PERMISSIONS,
} from "@repo/constants";
import { z } from "zod";

const IssueActivityCursorSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i,
    "Invalid issue activity cursor.",
  );

/** 댓글 수정·삭제 경로의 워크스페이스, 이슈, 댓글 식별자를 검증합니다. */
export const IssueCommentIdParamsSchema = z.object({
  workspaceId: z.uuid(),
  issueId: z.uuid(),
  commentId: z.uuid(),
});

/** 이슈 Activity 타임라인의 커서 페이지를 검증합니다. */
export const GetIssueActivitiesQuerySchema = z.object({
  cursor: IssueActivityCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** 댓글과 상태·담당자 변경을 공통 타임라인 항목으로 표현합니다. */
export const IssueActivitySchema = z.object({
  id: z.uuid(),
  type: z.enum(ISSUE_ACTIVITY_TYPE),
  actor: z.object({
    type: z.enum(ISSUE_ACTOR_TYPE),
    userId: z.uuid().nullable(),
    name: z.string(),
  }),
  body: z.string().nullable(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  mentions: z.array(
    z.object({
      userId: z.uuid(),
      name: z.string(),
    }),
  ),
  permissions: z.object({
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  }),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});

/** 이슈 Activity의 최근순 커서 페이지입니다. */
export const GetIssueActivitiesResponseSchema = z.object({
  items: z.array(IssueActivitySchema),
  nextCursor: z.string().nullable(),
});

/** GitHub Issue와 같은 일반 텍스트 댓글 입력을 검증합니다. */
export const CreateIssueCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  mentionedUserIds: z
    .array(z.uuid())
    .max(20)
    .default([])
    .transform((items) => [...new Set(items)]),
});

/** 생성된 댓글 Activity를 그대로 반환합니다. */
export const CreateIssueCommentResponseSchema = IssueActivitySchema;

/** 작성자가 댓글 본문과 멘션 대상을 수정할 때 사용하는 입력입니다. */
export const UpdateIssueCommentSchema = CreateIssueCommentSchema;

/** 수정된 댓글 Activity를 반환합니다. */
export const UpdateIssueCommentResponseSchema = IssueActivitySchema;

/** 소프트 삭제된 댓글 Activity를 반환합니다. */
export const DeleteIssueCommentResponseSchema = IssueActivitySchema;

const IssueCollaboratorSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(USER_PERMISSIONS),
});

/** 현재 담당자와 선택 가능한 조직 멤버를 함께 반환합니다. */
export const GetIssueAssigneesResponseSchema = z.object({
  assignees: z.array(IssueCollaboratorSchema),
  availableUsers: z.array(IssueCollaboratorSchema),
});

/** 이슈 담당자 전체 목록을 최대 10명까지 한 번에 교체합니다. */
export const UpdateIssueAssigneesSchema = z.object({
  userIds: z
    .array(z.uuid())
    .max(10)
    .transform((items) => [...new Set(items)]),
});

/** 담당자 변경 뒤 최신 협업 정보를 반환합니다. */
export const UpdateIssueAssigneesResponseSchema =
  GetIssueAssigneesResponseSchema;

/** 검증된 Activity 목록 query입니다. */
export type GetIssueActivitiesQueryDto = z.output<
  typeof GetIssueActivitiesQuerySchema
>;
/** 이슈 Activity 목록 API 응답입니다. */
export type GetIssueActivitiesResponseDto = z.infer<
  typeof GetIssueActivitiesResponseSchema
>;
/** 댓글 생성 API의 검증된 입력입니다. */
export type CreateIssueCommentDto = z.infer<typeof CreateIssueCommentSchema>;
/** 댓글 생성 API 응답입니다. */
export type CreateIssueCommentResponseDto = z.infer<
  typeof CreateIssueCommentResponseSchema
>;
/** 댓글 수정 API의 검증된 입력입니다. */
export type UpdateIssueCommentDto = z.output<typeof UpdateIssueCommentSchema>;
/** 댓글 수정 API 응답입니다. */
export type UpdateIssueCommentResponseDto = z.infer<
  typeof UpdateIssueCommentResponseSchema
>;
/** 이슈 담당자 조회 API 응답입니다. */
export type GetIssueAssigneesResponseDto = z.infer<
  typeof GetIssueAssigneesResponseSchema
>;
/** 담당자 변경 API의 검증된 입력입니다. */
export type UpdateIssueAssigneesDto = z.output<
  typeof UpdateIssueAssigneesSchema
>;
