import {
  CreateFirewallApprovalSchema,
  CreateIssueRecordSchema,
  FirewallApprovalIdParamsSchema,
  FirewallApprovalStatusResponseSchema,
  IngestEventBatchResponseSchema,
  IngestEventBatchSchema,
  IssueRecordAcceptedResponseSchema,
  RunDetailResponseSchema,
  RunEventListQuerySchema,
  RunEventListResponseSchema,
  RunListQuerySchema,
  RunListResponseSchema,
  RunParamsSchema,
  RuntimeConfigRequestSchema,
  RuntimeConfigResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const OPENAPI_BASE_PATH = "/openapi/v1";

export const openAPIContract = {
  basePath: OPENAPI_BASE_PATH,
  ingestEvents: defineEndpoint({
    method: "POST",
    path: "/events/batch",
    request: IngestEventBatchSchema,
    response: IngestEventBatchResponseSchema,
  }),
  createIssueRecord: defineEndpoint({
    method: "POST",
    path: "/issue-records",
    request: CreateIssueRecordSchema,
    response: IssueRecordAcceptedResponseSchema,
  }),
  /** Returns prompt versions and active firewall policies for an SDK. */
  getRuntimeConfig: defineEndpoint({
    method: "GET",
    path: "/runtime-config",
    request: RuntimeConfigRequestSchema,
    response: RuntimeConfigResponseSchema,
  }),
  createFirewallApproval: defineEndpoint({
    method: "POST",
    path: "/firewall-approvals",
    request: CreateFirewallApprovalSchema,
    response: FirewallApprovalStatusResponseSchema,
  }),
  getFirewallApproval: defineEndpoint({
    method: "GET",
    path: "/firewall-approvals/:approvalId",
    params: FirewallApprovalIdParamsSchema,
    request: null,
    response: FirewallApprovalStatusResponseSchema,
  }),
  listRuns: defineEndpoint({
    method: "GET",
    path: "/runs",
    request: RunListQuerySchema,
    response: RunListResponseSchema,
  }),
  getRun: defineEndpoint({
    method: "GET",
    path: "/runs/:runId",
    params: RunParamsSchema,
    request: null,
    response: RunDetailResponseSchema,
  }),
  listRunEvents: defineEndpoint({
    method: "GET",
    path: "/runs/:runId/events",
    params: RunParamsSchema,
    request: RunEventListQuerySchema,
    response: RunEventListResponseSchema,
  }),
};
