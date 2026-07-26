import { zValidator } from "@hono/zod-validator";
import { firewallApprovalContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { firewallApprovalService } from "./firewall-approval.service.js";

const factory = createFactory<AppEnv>();

/** 운영자 승인 요청 HTTP 핸들러를 생성합니다. */
export function createFirewallApprovalHandlers() {
  const list = factory.createHandlers(
    zValidator("param", firewallApprovalContract.list.params!),
    zValidator("query", firewallApprovalContract.list.request),
    async (c) => {
      const response = await firewallApprovalService.list(
        c.get("currentUserId"),
        c.req.valid("param").workspaceId,
        c.req.valid("query"),
      );
      return c.json(firewallApprovalContract.list.response.parse(response));
    },
  );
  const decide = factory.createHandlers(
    zValidator("param", firewallApprovalContract.decide.params!),
    zValidator("json", firewallApprovalContract.decide.request),
    async (c) => {
      const params = c.req.valid("param");
      const response = await firewallApprovalService.decide(
        c.get("currentUserId"),
        params.workspaceId,
        params.approvalId,
        c.req.valid("json"),
      );
      return c.json(firewallApprovalContract.decide.response.parse(response));
    },
  );
  return { list, decide };
}
