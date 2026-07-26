import {
  OrganizationIdParamsSchema,
  OrganizationProfileResponseSchema,
  OrganizationMemberListResponseSchema,
  OrganizationResponseSchema,
  ProfileImageResponseSchema,
  RegisterOrganizationSchema,
  SuccessResponseSchema,
  UpdateOrganizationProfileSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const ORGANIZATION_BASE_PATH = "/organization";

export const organizationContract = {
  basePath: ORGANIZATION_BASE_PATH,
  create: defineEndpoint({
    method: "POST",
    path: "/create",
    request: RegisterOrganizationSchema,
    response: OrganizationResponseSchema,
  }),
  getProfile: defineEndpoint({
    method: "GET",
    path: "/:organizationId/profile",
    params: OrganizationIdParamsSchema,
    request: null,
    response: OrganizationProfileResponseSchema,
  }),
  updateProfile: defineEndpoint({
    method: "PATCH",
    path: "/:organizationId/profile",
    params: OrganizationIdParamsSchema,
    request: UpdateOrganizationProfileSchema,
    response: OrganizationProfileResponseSchema,
  }),
  listMembers: defineEndpoint({
    method: "GET",
    path: "/:organizationId/members",
    params: OrganizationIdParamsSchema,
    request: null,
    response: OrganizationMemberListResponseSchema,
  }),
  uploadProfileImage: defineEndpoint({
    method: "PUT",
    path: "/:organizationId/profile/image",
    params: OrganizationIdParamsSchema,
    request: null,
    response: ProfileImageResponseSchema,
  }),
};
