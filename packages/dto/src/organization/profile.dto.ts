import { USER_PERMISSIONS } from "@repo/constants";
import { z } from "zod";

export const OrganizationIdParamsSchema = z.object({
  organizationId: z.uuid(),
});

export const UpdateOrganizationProfileSchema = z.object({
  name: z.string().trim().min(2).max(20),
});

export const OrganizationProfileResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  profileImageUrl: z.url().nullable(),
  role: z.enum(USER_PERMISSIONS),
});

export const OrganizationListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  profileImageUrl: z.url().nullable(),
  role: z.enum(USER_PERMISSIONS),
});

export const OrganizationListResponseSchema = z.object({
  items: z.array(OrganizationListItemSchema),
});

export const OrganizationMemberSchema = z.object({
  id: z.number().int(),
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  profileImageUrl: z.url().nullable(),
  role: z.enum(USER_PERMISSIONS),
  joinedAt: z.iso.datetime(),
});

export const OrganizationMemberListResponseSchema = z.object({
  items: z.array(OrganizationMemberSchema),
});

export const OrganizationMemberParamsSchema = OrganizationIdParamsSchema.extend(
  {
    memberId: z.coerce.number().int().positive(),
  },
);

export const UpdateOrganizationMemberRoleSchema = z.object({
  role: z.enum([
    USER_PERMISSIONS.ADMIN,
    USER_PERMISSIONS.MEMBER,
    USER_PERMISSIONS.VIEWER,
  ]),
});

export const TransferOrganizationOwnerSchema = z.object({
  userId: z.uuid(),
});

export const TransferOrganizationOwnerResponseSchema = z.object({
  previousOwnerUserId: z.uuid(),
  ownerUserId: z.uuid(),
});

export const DeleteOrganizationSchema = z.object({
  confirmationName: z.string().trim().min(1).max(200),
});

export type UpdateOrganizationProfileDto = z.infer<
  typeof UpdateOrganizationProfileSchema
>;
export type OrganizationProfileResponseDto = z.infer<
  typeof OrganizationProfileResponseSchema
>;
export type OrganizationListResponseDto = z.infer<
  typeof OrganizationListResponseSchema
>;
export type OrganizationMemberListResponseDto = z.infer<
  typeof OrganizationMemberListResponseSchema
>;
export type UpdateOrganizationMemberRoleDto = z.infer<
  typeof UpdateOrganizationMemberRoleSchema
>;
export type TransferOrganizationOwnerDto = z.infer<
  typeof TransferOrganizationOwnerSchema
>;
export type TransferOrganizationOwnerResponseDto = z.infer<
  typeof TransferOrganizationOwnerResponseSchema
>;
export type DeleteOrganizationDto = z.infer<typeof DeleteOrganizationSchema>;
