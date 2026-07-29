import {
  AcceptTeamInvitationResponseSchema,
  AcceptTeamInvitationSchema,
  TeamInvitationCodeQuerySchema,
  TeamInvitationDetailsResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const TEAM_INVITATION_BASE_PATH = "/invite";

/** 로그인 전 초대 확인과 로그인 후 수락에 사용하는 공개 계약입니다. */
export const teamInvitationContract = {
  basePath: TEAM_INVITATION_BASE_PATH,
  get: defineEndpoint({
    method: "GET",
    path: "/",
    request: TeamInvitationCodeQuerySchema,
    response: TeamInvitationDetailsResponseSchema,
  }),
  accept: defineEndpoint({
    method: "POST",
    path: "/accept",
    request: AcceptTeamInvitationSchema,
    response: AcceptTeamInvitationResponseSchema,
  }),
} as const;
