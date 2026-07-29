import {
  ACCESS_INVITATION_STATUS,
  USER_PERMISSIONS,
} from "@repo/constants";
import { z } from "zod";
import { OrganizationIdParamsSchema } from "../organization/profile.dto.js";

export const TEAM_INVITATION_ROLES = [
  USER_PERMISSIONS.ADMIN,
  USER_PERMISSIONS.MEMBER,
  USER_PERMISSIONS.VIEWER,
] as const;

/** 조직 멤버 초대를 생성할 때 사용하는 입력 계약입니다. */
export const CreateTeamInvitationSchema = z.object({
  email: z.email(),
  role: z.enum(TEAM_INVITATION_ROLES).default(USER_PERMISSIONS.MEMBER),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(24 * 7),
});

/** 조직 초대 한 건을 식별하는 경로 파라미터입니다. */
export const TeamInvitationParamsSchema = OrganizationIdParamsSchema.extend({
  invitationId: z.uuid(),
});

/** 공개 초대 링크에서 전달하는 일회성 UUID 코드입니다. */
export const TeamInvitationCodeQuerySchema = z.object({
  code: z.uuid(),
});

export const AcceptTeamInvitationSchema = TeamInvitationCodeQuerySchema;

/** 조직 설정 목록에 표시하는 초대 상태입니다. */
export const TeamInvitationResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(TEAM_INVITATION_ROLES),
  status: z.enum(ACCESS_INVITATION_STATUS),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

/** 초대 생성 직후 한 번만 반환하는 공유 링크를 포함합니다. */
export const CreateTeamInvitationResponseSchema =
  TeamInvitationResponseSchema.extend({
    invitationUrl: z.url(),
  });

export const TeamInvitationListResponseSchema = z.object({
  items: z.array(TeamInvitationResponseSchema),
});

/** 로그인 전 초대 화면에 노출할 최소 조직 정보입니다. */
export const TeamInvitationDetailsResponseSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  emailHint: z.string(),
  role: z.enum(TEAM_INVITATION_ROLES),
  status: z.enum(ACCESS_INVITATION_STATUS),
  expiresAt: z.string().datetime(),
});

/** 초대 수락 뒤 이동할 조직과 내부 경로입니다. */
export const AcceptTeamInvitationResponseSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  redirectTo: z.string().startsWith("/"),
});

export type CreateTeamInvitationDto = z.infer<
  typeof CreateTeamInvitationSchema
>;
export type TeamInvitationResponseDto = z.infer<
  typeof TeamInvitationResponseSchema
>;
export type CreateTeamInvitationResponseDto = z.infer<
  typeof CreateTeamInvitationResponseSchema
>;
export type TeamInvitationDetailsResponseDto = z.infer<
  typeof TeamInvitationDetailsResponseSchema
>;
export type AcceptTeamInvitationResponseDto = z.infer<
  typeof AcceptTeamInvitationResponseSchema
>;
export type TeamInvitationRole = z.infer<
  typeof TeamInvitationResponseSchema
>["role"];
