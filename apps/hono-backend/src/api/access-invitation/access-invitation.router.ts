import { ADMIN_ROLES } from "@repo/constants";
import { accessContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAdminAccess } from "../../common/middleware/admin-access.middleware.js";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireAdminRole } from "../../common/middleware/admin-role.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createAccessInvitationHandlers } from "./access-invitation.handler.js";

const handlers = createAccessInvitationHandlers();

/** Lynx 관리자가 파일럿 초대를 발급하고 취소하는 내부 라우터입니다. */
export const accessInvitationRouter = new Hono<AppEnv>();

accessInvitationRouter.use("*", requireAccessToken);
accessInvitationRouter.use("*", requireAdminAccess);
accessInvitationRouter.on(
  accessContract.createInvitation.method,
  accessContract.createInvitation.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.create,
);
accessInvitationRouter.on(
  accessContract.listInvitations.method,
  accessContract.listInvitations.path,
  ...handlers.list,
);
accessInvitationRouter.on(
  accessContract.revokeInvitation.method,
  accessContract.revokeInvitation.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.revoke,
);
