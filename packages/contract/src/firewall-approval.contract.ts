import {
  DecideFirewallApprovalSchema,
  FirewallApprovalListQuerySchema,
  FirewallApprovalListResponseSchema,
  FirewallApprovalStatusResponseSchema,
  WorkspaceFirewallApprovalIdParamsSchema,
  WorkspaceIdParamsSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const firewallApprovalContract = {
  basePath: "/workspace",
  list: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/firewall-approvals",
    params: WorkspaceIdParamsSchema,
    request: FirewallApprovalListQuerySchema,
    response: FirewallApprovalListResponseSchema,
  }),
  decide: defineEndpoint({
    method: "PATCH",
    path: "/:workspaceId/firewall-approvals/:approvalId",
    params: WorkspaceFirewallApprovalIdParamsSchema,
    request: DecideFirewallApprovalSchema,
    response: FirewallApprovalStatusResponseSchema,
  }),
};
