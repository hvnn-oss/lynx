import { teamInvitationContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createTeamInvitationHandlers } from "./team-invitation.handler.js";

const handlers = createTeamInvitationHandlers();

/** 초대 링크 확인과 수락을 제공하는 공개 진입 라우터입니다. */
export const teamInvitationRouter = new Hono<AppEnv>();

teamInvitationRouter.on(
  teamInvitationContract.get.method,
  teamInvitationContract.get.path,
  ...handlers.get,
);
teamInvitationRouter.on(
  teamInvitationContract.accept.method,
  teamInvitationContract.accept.path,
  requireAccessToken,
  ...handlers.accept,
);
