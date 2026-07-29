import {
  OrganizationIdParamsSchema,
  OrganizationListResponseSchema,
  OrganizationProfileResponseSchema,
  OrganizationMemberListResponseSchema,
  OrganizationResponseSchema,
  ProfileImageResponseSchema,
  RegisterOrganizationSchema,
  SuccessResponseSchema,
  UpdateOrganizationProfileSchema,
  CreateTeamInvitationSchema,
  CreateTeamInvitationResponseSchema,
  TeamInvitationListResponseSchema,
  TeamInvitationParamsSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const ORGANIZATION_BASE_PATH = "/organization";

export const organizationContract = {
  basePath: ORGANIZATION_BASE_PATH,
  list: defineEndpoint({
    method: "GET",
    path: "/list",
    request: null,
    response: OrganizationListResponseSchema,
  }),
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
  createInvitation: defineEndpoint({
    method: "POST",
    path: "/:organizationId/invitations",
    params: OrganizationIdParamsSchema,
    request: CreateTeamInvitationSchema,
    response: CreateTeamInvitationResponseSchema,
  }),
  listInvitations: defineEndpoint({
    method: "GET",
    path: "/:organizationId/invitations",
    params: OrganizationIdParamsSchema,
    request: null,
    response: TeamInvitationListResponseSchema,
  }),
  revokeInvitation: defineEndpoint({
    method: "DELETE",
    path: "/:organizationId/invitations/:invitationId",
    params: TeamInvitationParamsSchema,
    request: null,
    response: SuccessResponseSchema,
  }),
  uploadProfileImage: defineEndpoint({
    method: "PUT",
    path: "/:organizationId/profile/image",
    params: OrganizationIdParamsSchema,
    request: null,
    response: ProfileImageResponseSchema,
  }),
};
