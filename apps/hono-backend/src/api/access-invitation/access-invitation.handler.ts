import { zValidator } from "@hono/zod-validator";
import { accessContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { accessInvitationService } from "./access-invitation.service.js";

const factory = createFactory<AppEnv>();

/** 파일럿 초대 관리 계약에 맞는 HTTP handler를 생성합니다. */
export function createAccessInvitationHandlers() {
  const create = factory.createHandlers(
    zValidator("json", accessContract.createInvitation.request),
    async (context) =>
      context.json(
        accessContract.createInvitation.response.parse(
          await accessInvitationService.create(
            context.get("currentUserId"),
            context.req.valid("json"),
          ),
        ),
        201,
      ),
  );

  const list = factory.createHandlers(
    zValidator("query", accessContract.listInvitations.request),
    async (context) =>
      context.json(
        accessContract.listInvitations.response.parse(
          await accessInvitationService.list(context.req.valid("query")),
        ),
      ),
  );

  const revoke = factory.createHandlers(
    zValidator("param", accessContract.revokeInvitation.params!),
    async (context) =>
      context.json(
        accessContract.revokeInvitation.response.parse(
          await accessInvitationService.revoke(
            context.req.valid("param").invitationId,
          ),
        ),
      ),
  );

  return { create, list, revoke };
}
