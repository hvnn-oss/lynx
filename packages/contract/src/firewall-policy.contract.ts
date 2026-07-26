import {
  CreateFirewallPolicySchema,
  FirewallPolicyDeleteResponseSchema,
  FirewallPolicyIdParamsSchema,
  FirewallPolicyListResponseSchema,
  FirewallPolicyMutationResponseSchema,
  FirewallPolicyRevisionParamsSchema,
  SimulateFirewallPolicyResponseSchema,
  SimulateFirewallPolicySchema,
  UpdateFirewallPolicySchema,
  WorkspaceIdParamsSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const FIREWALL_POLICY_BASE_PATH = "/workspace";

export const firewallPolicyContract = {
  basePath: FIREWALL_POLICY_BASE_PATH,
  list: defineEndpoint({
    method: "GET",
    path: "/:workspaceId/firewall-policies",
    params: WorkspaceIdParamsSchema,
    request: null,
    response: FirewallPolicyListResponseSchema,
  }),
  create: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/firewall-policies",
    params: WorkspaceIdParamsSchema,
    request: CreateFirewallPolicySchema,
    response: FirewallPolicyMutationResponseSchema,
  }),
  update: defineEndpoint({
    method: "PATCH",
    path: "/:workspaceId/firewall-policies/:policyId",
    params: FirewallPolicyIdParamsSchema,
    request: UpdateFirewallPolicySchema,
    response: FirewallPolicyMutationResponseSchema,
  }),
  activate: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/firewall-policies/:policyId/activate",
    params: FirewallPolicyIdParamsSchema,
    request: null,
    response: FirewallPolicyMutationResponseSchema,
  }),
  deactivate: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/firewall-policies/:policyId/deactivate",
    params: FirewallPolicyIdParamsSchema,
    request: null,
    response: FirewallPolicyMutationResponseSchema,
  }),
  deploy: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/firewall-policies/:policyId/deploy",
    params: FirewallPolicyIdParamsSchema,
    request: null,
    response: FirewallPolicyMutationResponseSchema,
  }),
  rollback: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/firewall-policies/:policyId/rollback/:revision",
    params: FirewallPolicyRevisionParamsSchema,
    request: null,
    response: FirewallPolicyMutationResponseSchema,
  }),
  simulate: defineEndpoint({
    method: "POST",
    path: "/:workspaceId/firewall-policies/:policyId/simulate",
    params: FirewallPolicyIdParamsSchema,
    request: SimulateFirewallPolicySchema,
    response: SimulateFirewallPolicyResponseSchema,
  }),
  delete: defineEndpoint({
    method: "DELETE",
    path: "/:workspaceId/firewall-policies/:policyId",
    params: FirewallPolicyIdParamsSchema,
    request: null,
    response: FirewallPolicyDeleteResponseSchema,
  }),
};
