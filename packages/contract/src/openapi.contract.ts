import {
  IngestEventBatchResponseSchema,
  IngestEventBatchSchema,
  CreateIssueRecordSchema,
  IssueRecordAcceptedResponseSchema,
  RuntimeConfigRequestSchema,
  RuntimeConfigResponseSchema,
  RunDetailResponseSchema,
  RunListQuerySchema,
  RunListResponseSchema,
  RunParamsSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const openAPIContract = {
  basePath: "/openapi/v1",
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
  /** SDK가 현재 프롬프트와 활성 정책을 한 번에 조회하는 계약입니다. */
  getRuntimeConfig: defineEndpoint({
    method: "GET",
    path: "/runtime-config",
    request: RuntimeConfigRequestSchema,
    response: RuntimeConfigResponseSchema,
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
    request: RunParamsSchema,
    response: RunDetailResponseSchema,
  }),
};
