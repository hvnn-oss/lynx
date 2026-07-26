import {
  HealthResponseSchema,
  OpenAPIDocumentResponseSchema,
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
  openApiDocument: defineEndpoint({
    method: "GET",
    path: "/openapi.json",
    request: null,
    response: OpenAPIDocumentResponseSchema,
  }),
} as const;
