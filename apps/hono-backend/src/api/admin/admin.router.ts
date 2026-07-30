import { ADMIN_ROLES } from "@repo/constants";
import { adminContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAdminAccess } from "../../common/middleware/admin-access.middleware.js";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireAdminRole } from "../../common/middleware/admin-role.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createAdminHandlers } from "./admin.handler.js";

const handlers = createAdminHandlers();

/** Lynx 내부 운영자만 접근할 수 있는 관리자 API입니다. */
export const adminRouter = new Hono<AppEnv>();

adminRouter.use("*", requireAccessToken);
adminRouter.use("*", requireAdminAccess);
adminRouter.on(
  adminContract.overview.method,
  adminContract.overview.path,
  ...handlers.overview,
);
adminRouter.on(
  adminContract.listAuditLogs.method,
  adminContract.listAuditLogs.path,
  ...handlers.listAuditLogs,
);
adminRouter.on(
  adminContract.getAuditLog.method,
  adminContract.getAuditLog.path,
  ...handlers.getAuditLog,
);
adminRouter.on(
  adminContract.listApiKeys.method,
  adminContract.listApiKeys.path,
  ...handlers.listApiKeys,
);
adminRouter.on(
  adminContract.getOpenApiUsage.method,
  adminContract.getOpenApiUsage.path,
  ...handlers.getOpenApiUsage,
);
adminRouter.on(
  adminContract.revokeApiKey.method,
  adminContract.revokeApiKey.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.revokeApiKey,
);
adminRouter.on(
  adminContract.listOrganizations.method,
  adminContract.listOrganizations.path,
  ...handlers.listOrganizations,
);
adminRouter.on(
  adminContract.getOrganization.method,
  adminContract.getOrganization.path,
  ...handlers.getOrganization,
);
adminRouter.on(
  adminContract.updateOrganizationPlan.method,
  adminContract.updateOrganizationPlan.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.updateOrganizationPlan,
);
adminRouter.on(
  adminContract.listUsers.method,
  adminContract.listUsers.path,
  ...handlers.listUsers,
);
adminRouter.on(
  adminContract.getUser.method,
  adminContract.getUser.path,
  ...handlers.getUser,
);
adminRouter.on(
  adminContract.updateUserAdminAccess.method,
  adminContract.updateUserAdminAccess.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.updateUserAdminAccess,
);
adminRouter.on(
  adminContract.deleteUser.method,
  adminContract.deleteUser.path,
  requireAdminRole(ADMIN_ROLES.SENIOR_ADMIN),
  ...handlers.deleteUser,
);
adminRouter.on(
  adminContract.listPilotParticipants.method,
  adminContract.listPilotParticipants.path,
  ...handlers.listPilotParticipants,
);
adminRouter.on(
  adminContract.updatePilotParticipant.method,
  adminContract.updatePilotParticipant.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.updatePilotParticipant,
);
adminRouter.on(
  adminContract.listPlans.method,
  adminContract.listPlans.path,
  ...handlers.listPlans,
);
adminRouter.on(
  adminContract.createPlan.method,
  adminContract.createPlan.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.createPlan,
);
adminRouter.on(
  adminContract.updatePlan.method,
  adminContract.updatePlan.path,
  requireAdminRole(ADMIN_ROLES.ADMIN),
  ...handlers.updatePlan,
);
