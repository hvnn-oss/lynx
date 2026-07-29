import {
  AccessInvitationIdParamsSchema,
  AccessInvitationListResponseSchema,
  AccessInvitationResponseSchema,
  CreateAccessInvitationSchema,
  ListAccessInvitationsQuerySchema,
  SuccessResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const ACCESS_BASE_PATH = "/access";

/** 파일럿 초대와 제품 접근 승인을 관리하는 내부 계약입니다. */
export const accessContract = {
  basePath: ACCESS_BASE_PATH,
  createInvitation: defineEndpoint({
    method: "POST",
    path: "/invitations",
    request: CreateAccessInvitationSchema,
    response: AccessInvitationResponseSchema,
  }),
  listInvitations: defineEndpoint({
    method: "GET",
    path: "/invitations",
    request: ListAccessInvitationsQuerySchema,
    response: AccessInvitationListResponseSchema,
  }),
  revokeInvitation: defineEndpoint({
    method: "DELETE",
    path: "/invitations/:invitationId",
    params: AccessInvitationIdParamsSchema,
    request: null,
    response: SuccessResponseSchema,
  }),
} as const;
