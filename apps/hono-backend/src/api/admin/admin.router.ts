import { adminContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAdminAccess } from "../../common/middleware/admin-access.middleware.js";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
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
  ...handlers.updateOrganizationPlan,
);
adminRouter.on(
  adminContract.listPilotParticipants.method,
  adminContract.listPilotParticipants.path,
  ...handlers.listPilotParticipants,
);
adminRouter.on(
  adminContract.updatePilotParticipant.method,
  adminContract.updatePilotParticipant.path,
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
  ...handlers.createPlan,
);
adminRouter.on(
  adminContract.updatePlan.method,
  adminContract.updatePlan.path,
  ...handlers.updatePlan,
);
