import { zValidator } from "@hono/zod-validator";
import { teamInvitationContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { accessInvitationService } from "./access-invitation.service.js";

const factory = createFactory<AppEnv>();

/** 공개 초대 조회와 로그인 사용자 수락 handler를 생성합니다. */
export function createTeamInvitationHandlers() {
  /** 코드에 해당하는 조직 초대의 공개 정보를 조회합니다. */
  const get = factory.createHandlers(
    zValidator("query", teamInvitationContract.get.request),
    async (c) =>
      c.json(
        teamInvitationContract.get.response.parse(
          await accessInvitationService.getTeamInvitation(
            c.req.valid("query").code,
          ),
        ),
      ),
  );

  /** 현재 로그인 사용자가 자신의 이메일로 발급된 초대를 수락합니다. */
  const accept = factory.createHandlers(
    zValidator("json", teamInvitationContract.accept.request),
    async (c) =>
      c.json(
        teamInvitationContract.accept.response.parse(
          await accessInvitationService.acceptTeamInvitation(
            c.get("currentUserId"),
            c.req.valid("json").code,
          ),
        ),
      ),
  );

  return { accept, get };
}
