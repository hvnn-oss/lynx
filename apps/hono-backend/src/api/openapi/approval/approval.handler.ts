import { zValidator } from "@hono/zod-validator";
import { openAPIContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../../common/types/app-env.js";
import { BadRequestErrorException } from "../../../common/exceptions/bad-request.js";
import { openAPIApprovalService } from "./approval.service.js";

const factory = createFactory<AppEnv>();

/** Creates the HTTP handlers used by the SDK approval flow. */
export function createOpenAPIApprovalHandlers() {
  const create = factory.createHandlers(
    zValidator("json", openAPIContract.createFirewallApproval.request),
    async (c) => {
      const sdkInstanceId = c.req.header("X-Lynx-Client-ID")?.trim();
      if (!sdkInstanceId) {
        throw new BadRequestErrorException("LYNX_CLIENT_ID_REQUIRED");
      }
      const response = await openAPIApprovalService.create(
        c.get("currentWorkspaceId"),
        sdkInstanceId,
        c.req.valid("json"),
      );
      return c.json(
        openAPIContract.createFirewallApproval.response.parse(response),
        201,
      );
    },
  );

  const get = factory.createHandlers(
    zValidator("param", openAPIContract.getFirewallApproval.params!),
    async (c) => {
      const sdkInstanceId = c.req.header("X-Lynx-Client-ID")?.trim();
      if (!sdkInstanceId) {
        throw new BadRequestErrorException("LYNX_CLIENT_ID_REQUIRED");
      }
      const response = await openAPIApprovalService.get(
        c.get("currentWorkspaceId"),
        sdkInstanceId,
        c.req.valid("param").approvalId,
      );
      return c.json(
        openAPIContract.getFirewallApproval.response.parse(response),
      );
    },
  );

  return { create, get };
}
