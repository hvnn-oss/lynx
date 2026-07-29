import {
  HealthResponseSchema,
  OpenAPIDocumentResponseSchema,
  ReadinessResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const systemContract = {
  basePath: "",
  health: defineEndpoint({
    method: "GET",
    path: "/health",
    request: null,
    response: HealthResponseSchema,
  }),
  liveness: defineEndpoint({
    method: "GET",
    path: "/health/live",
    request: null,
    response: HealthResponseSchema,
  }),
  readiness: defineEndpoint({
    method: "GET",
    path: "/health/ready",
    request: null,
    response: ReadinessResponseSchema,
  }),
  openApiDocument: defineEndpoint({
    method: "GET",
    path: "/openapi.json",
    request: null,
    response: OpenAPIDocumentResponseSchema,
  }),
} as const;
