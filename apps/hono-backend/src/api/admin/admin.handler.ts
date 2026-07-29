import { zValidator } from "@hono/zod-validator";
import { adminContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { adminService } from "./admin.service.js";

const factory = createFactory<AppEnv>();

/** 관리자 계약에 맞는 조회 및 관리 HTTP handler를 생성합니다. */
export function createAdminHandlers() {
  const overview = factory.createHandlers(async (context) =>
    context.json(
      adminContract.overview.response.parse(
        await adminService.getOverview(context.get("currentUserId")),
      ),
    ),
  );

  const listAuditLogs = factory.createHandlers(
    zValidator("query", adminContract.listAuditLogs.request),
    async (context) =>
      context.json(
        adminContract.listAuditLogs.response.parse(
          await adminService.listAuditLogs(context.req.valid("query")),
        ),
      ),
  );

  const getAuditLog = factory.createHandlers(
    zValidator("param", adminContract.getAuditLog.params!),
    async (context) =>
      context.json(
        adminContract.getAuditLog.response.parse(
          await adminService.getAuditLog(context.req.valid("param").auditLogId),
        ),
      ),
  );

  const listApiKeys = factory.createHandlers(
    zValidator("query", adminContract.listApiKeys.request),
    async (context) =>
      context.json(
        adminContract.listApiKeys.response.parse(
          await adminService.listApiKeys(context.req.valid("query")),
        ),
      ),
  );

  const getOpenApiUsage = factory.createHandlers(
    zValidator("query", adminContract.getOpenApiUsage.request),
    async (context) =>
      context.json(
        adminContract.getOpenApiUsage.response.parse(
          await adminService.getOpenApiUsage(context.req.valid("query")),
        ),
      ),
  );

  const revokeApiKey = factory.createHandlers(
    zValidator("param", adminContract.revokeApiKey.params!),
    async (context) =>
      context.json(
        adminContract.revokeApiKey.response.parse(
          await adminService.revokeApiKey(
            context.get("currentUserId"),
            context.req.valid("param").apiKeyId,
            context.get("requestId"),
          ),
        ),
      ),
  );

  const listOrganizations = factory.createHandlers(
    zValidator("query", adminContract.listOrganizations.request),
    async (context) =>
      context.json(
        adminContract.listOrganizations.response.parse(
          await adminService.listOrganizations(context.req.valid("query")),
        ),
      ),
  );

  const getOrganization = factory.createHandlers(
    zValidator("param", adminContract.getOrganization.params!),
    async (context) =>
      context.json(
        adminContract.getOrganization.response.parse(
          await adminService.getOrganization(
            context.req.valid("param").organizationId,
          ),
        ),
      ),
  );

  const updateOrganizationPlan = factory.createHandlers(
    zValidator("param", adminContract.updateOrganizationPlan.params!),
    zValidator("json", adminContract.updateOrganizationPlan.request),
    async (context) =>
      context.json(
        adminContract.updateOrganizationPlan.response.parse(
          await adminService.updateOrganizationPlan(
            context.get("currentUserId"),
            context.req.valid("param").organizationId,
            context.req.valid("json").planId,
            context.get("requestId"),
          ),
        ),
      ),
  );

  const listPilotParticipants = factory.createHandlers(
    zValidator("query", adminContract.listPilotParticipants.request),
    async (context) =>
      context.json(
        adminContract.listPilotParticipants.response.parse(
          await adminService.listPilotParticipants(context.req.valid("query")),
        ),
      ),
  );

  const updatePilotParticipant = factory.createHandlers(
    zValidator("param", adminContract.updatePilotParticipant.params!),
    zValidator("json", adminContract.updatePilotParticipant.request),
    async (context) =>
      context.json(
        adminContract.updatePilotParticipant.response.parse(
          await adminService.updatePilotParticipant(
            context.get("currentUserId"),
            context.req.valid("param").participantId,
            context.req.valid("json"),
            context.get("requestId"),
          ),
        ),
      ),
  );

  const listPlans = factory.createHandlers(async (context) =>
    context.json(
      adminContract.listPlans.response.parse(await adminService.listPlans()),
    ),
  );

  const createPlan = factory.createHandlers(
    zValidator("json", adminContract.createPlan.request),
    async (context) =>
      context.json(
        adminContract.createPlan.response.parse(
          await adminService.createPlan(
            context.get("currentUserId"),
            context.req.valid("json"),
            context.get("requestId"),
          ),
        ),
        201,
      ),
  );

  const updatePlan = factory.createHandlers(
    zValidator("param", adminContract.updatePlan.params!),
    zValidator("json", adminContract.updatePlan.request),
    async (context) =>
      context.json(
        adminContract.updatePlan.response.parse(
          await adminService.updatePlan(
            context.get("currentUserId"),
            context.req.valid("param").planId,
            context.req.valid("json"),
            context.get("requestId"),
          ),
        ),
      ),
  );

  return {
    overview,
    listAuditLogs,
    getAuditLog,
    listApiKeys,
    getOpenApiUsage,
    revokeApiKey,
    listOrganizations,
    getOrganization,
    updateOrganizationPlan,
    listPilotParticipants,
    updatePilotParticipant,
    listPlans,
    createPlan,
    updatePlan,
  };
}
