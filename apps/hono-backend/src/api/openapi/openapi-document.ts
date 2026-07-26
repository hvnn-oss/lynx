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
  RuntimeConfigResponseSchema,
  PublicErrorResponseSchema,
} from "@repo/dto";
import { openAPIContract, type ContractEndpoint } from "@repo/contract";
import { z } from "zod";

type JSONSchema = Record<string, unknown>;
type HTTPMethod = "get" | "post";

const jsonContent = (schemaName: string) => ({
  "application/json": {
    schema: { $ref: `#/components/schemas/${schemaName}` },
  },
});

const apiKeySecurity = [{ WorkspaceApiKey: [] }];

const commonErrorResponses = {
  "400": {
    description: "The request does not match the public contract.",
    content: jsonContent("ErrorResponse"),
  },
  "401": {
    description: "The workspace API key is missing or invalid.",
    content: jsonContent("ErrorResponse"),
  },
  "403": {
    description: "The API key does not have the required scope.",
    content: jsonContent("ErrorResponse"),
  },
  "429": {
    description: "The rate limit was exceeded.",
    headers: {
      "Retry-After": {
        description: "Seconds to wait before retrying.",
        schema: { type: "integer", minimum: 0 },
      },
    },
    content: jsonContent("ErrorResponse"),
  },
};

function toOpenAPISchema(schema: z.ZodType): JSONSchema {
  return z.toJSONSchema(schema, {
    target: "openapi-3.0",
    unrepresentable: "any",
    reused: "inline",
  }) as JSONSchema;
}

function createQueryParameters(schema: z.ZodType): JSONSchema[] {
  const jsonSchema = toOpenAPISchema(schema);
  const properties = (jsonSchema.properties ?? {}) as Record<
    string,
    JSONSchema
  >;
  const required = new Set(
    Array.isArray(jsonSchema.required) ? (jsonSchema.required as string[]) : [],
  );

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: propertySchema,
  }));
}

function operation(
  endpoint: ContractEndpoint,
  value: Record<string, unknown>,
) {
  return {
    path: endpoint.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}"),
    method: endpoint.method.toLowerCase() as HTTPMethod,
    value,
  };
}

const operations = [
  operation(openAPIContract.ingestEvents, {
    operationId: "ingestEventBatch",
    tags: ["Events"],
    summary: "Record a batch of agent events",
    description:
      "Records up to 100 events. Individual event failures are reported without failing the complete batch.",
    security: apiKeySecurity,
    "x-required-scopes": ["events:write"],
    requestBody: {
      required: true,
      content: jsonContent("IngestEventBatch"),
    },
    responses: {
      "200": {
        description: "The batch was processed.",
        content: jsonContent("IngestEventBatchResponse"),
      },
      "413": {
        description: "The request body exceeds 1 MiB.",
        content: jsonContent("ErrorResponse"),
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.createIssueRecord, {
    operationId: "createIssueRecord",
    tags: ["Issues"],
    summary: "Submit an issue candidate",
    security: apiKeySecurity,
    "x-required-scopes": ["events:write"],
    requestBody: {
      required: true,
      content: jsonContent("CreateIssueRecord"),
    },
    responses: {
      "202": {
        description: "The record was accepted for asynchronous review.",
        content: jsonContent("IssueRecordAcceptedResponse"),
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.getRuntimeConfig, {
    operationId: "getRuntimeConfig",
    tags: ["Runtime configuration"],
    summary: "Load prompt versions and active firewall policies",
    security: apiKeySecurity,
    "x-required-scopes": ["config:read", "policies:read"],
    parameters: [
      {
        name: "X-Lynx-Agent-ID",
        in: "header",
        required: false,
        schema: { type: "string" },
      },
      {
        name: "X-Lynx-Client-ID",
        in: "header",
        required: false,
        schema: { type: "string" },
      },
      {
        name: "If-None-Match",
        in: "header",
        required: false,
        schema: { type: "string" },
      },
    ],
    responses: {
      "200": {
        description: "The current runtime configuration.",
        headers: {
          ETag: {
            description: "Revision used for conditional refresh.",
            schema: { type: "string" },
          },
        },
        content: jsonContent("RuntimeConfigResponse"),
      },
      "304": {
        description: "The cached runtime configuration is still current.",
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.createFirewallApproval, {
    operationId: "createFirewallApproval",
    tags: ["Firewall approvals"],
    summary: "Request approval for a protected tool call",
    security: apiKeySecurity,
    "x-required-scopes": ["events:write"],
    parameters: [
      {
        name: "X-Lynx-Client-ID",
        in: "header",
        required: true,
        schema: { type: "string", minLength: 1 },
      },
    ],
    requestBody: {
      required: true,
      content: jsonContent("CreateFirewallApproval"),
    },
    responses: {
      "201": {
        description: "The approval request was created or deduplicated.",
        content: jsonContent("FirewallApprovalStatusResponse"),
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.getFirewallApproval, {
    operationId: "getFirewallApproval",
    tags: ["Firewall approvals"],
    summary: "Read the current approval status",
    security: apiKeySecurity,
    "x-required-scopes": ["policies:read"],
    parameters: [
      {
        name: "approvalId",
        in: "path",
        required: true,
        schema: toOpenAPISchema(
          FirewallApprovalIdParamsSchema.shape.approvalId,
        ),
      },
      {
        name: "X-Lynx-Client-ID",
        in: "header",
        required: true,
        schema: { type: "string", minLength: 1 },
      },
    ],
    responses: {
      "200": {
        description: "The current approval status.",
        content: jsonContent("FirewallApprovalStatusResponse"),
      },
      "404": {
        description:
          "The approval request was not found for this SDK instance.",
        content: jsonContent("ErrorResponse"),
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.listRuns, {
    operationId: "listRuns",
    tags: ["Runs"],
    summary: "List recent runs",
    security: apiKeySecurity,
    "x-required-scopes": ["usage:read"],
    parameters: createQueryParameters(RunListQuerySchema),
    responses: {
      "200": {
        description: "A bounded page of runs.",
        content: jsonContent("RunListResponse"),
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.getRun, {
    operationId: "getRun",
    tags: ["Runs"],
    summary: "Read one run and its first event page",
    security: apiKeySecurity,
    "x-required-scopes": ["usage:read"],
    parameters: [
      {
        name: "runId",
        in: "path",
        required: true,
        schema: toOpenAPISchema(RunParamsSchema.shape.runId),
      },
    ],
    responses: {
      "200": {
        description: "The run and its first bounded event page.",
        content: jsonContent("RunDetailResponse"),
      },
      "404": {
        description: "The run was not found.",
        content: jsonContent("ErrorResponse"),
      },
      ...commonErrorResponses,
    },
  }),
  operation(openAPIContract.listRunEvents, {
    operationId: "listRunEvents",
    tags: ["Runs"],
    summary: "Page through a run event timeline",
    security: apiKeySecurity,
    "x-required-scopes": ["usage:read"],
    parameters: [
      {
        name: "runId",
        in: "path",
        required: true,
        schema: toOpenAPISchema(RunParamsSchema.shape.runId),
      },
      ...createQueryParameters(RunEventListQuerySchema),
    ],
    responses: {
      "200": {
        description: "A bounded page of run events.",
        content: jsonContent("RunEventListResponse"),
      },
      ...commonErrorResponses,
    },
  }),
];

const paths = operations.reduce<Record<string, Record<string, unknown>>>(
  (documentPaths, { path, method, value }) => {
    documentPaths[path] ??= {};
    documentPaths[path][method] = value;
    return documentPaths;
  },
  {},
);

/**
 * Public OpenAPI 3.0 document used by code generators and API tooling.
 *
 * Request and response shapes are generated directly from the same Zod schemas
 * used by the HTTP handlers so DTO changes remain visible in the public schema.
 */
export const openAPIDocument = {
  openapi: "3.0.3",
  info: {
    title: "Lynx OpenAPI",
    version: "1.0.0",
    description:
      "Record agent runs, load runtime configuration, request firewall approval, and inspect run timelines.",
  },
  servers: [{ url: "/openapi/v1" }],
  tags: [
    { name: "Events" },
    { name: "Issues" },
    { name: "Runtime configuration" },
    { name: "Firewall approvals" },
    { name: "Runs" },
  ],
  paths,
  components: {
    securitySchemes: {
      WorkspaceApiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description:
          "Workspace API key. Each operation lists required scopes in x-required-scopes.",
      },
    },
    schemas: {
      IngestEventBatch: toOpenAPISchema(IngestEventBatchSchema),
      IngestEventBatchResponse: toOpenAPISchema(IngestEventBatchResponseSchema),
      CreateIssueRecord: toOpenAPISchema(CreateIssueRecordSchema),
      IssueRecordAcceptedResponse: toOpenAPISchema(
        IssueRecordAcceptedResponseSchema,
      ),
      RuntimeConfigResponse: toOpenAPISchema(RuntimeConfigResponseSchema),
      CreateFirewallApproval: toOpenAPISchema(CreateFirewallApprovalSchema),
      FirewallApprovalStatusResponse: toOpenAPISchema(
        FirewallApprovalStatusResponseSchema,
      ),
      RunListResponse: toOpenAPISchema(RunListResponseSchema),
      RunDetailResponse: toOpenAPISchema(RunDetailResponseSchema),
      RunEventListResponse: toOpenAPISchema(RunEventListResponseSchema),
      ErrorResponse: toOpenAPISchema(PublicErrorResponseSchema),
    },
  },
} as const;
