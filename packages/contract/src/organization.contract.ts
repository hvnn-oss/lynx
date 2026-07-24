import {
  OrganizationResponseSchema,
  RegisterOrganizationSchema,
  SuccessResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

const ORGANIZATION_BASE_PATH = "/organization" as const;

export const organizationContract = {
  basePath: ORGANIZATION_BASE_PATH,
  create: defineEndpoint({
    method: "POST",
    path: "/create",
    request: RegisterOrganizationSchema,
    response: OrganizationResponseSchema,
  }),
};
