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

export const OrganizationMemberSchema = z.object({
  id: z.number().int(),
  userId: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(USER_PERMISSIONS),
  joinedAt: z.iso.datetime(),
});

export const OrganizationMemberListResponseSchema = z.object({
  items: z.array(OrganizationMemberSchema),
});

export type UpdateOrganizationProfileDto = z.infer<
  typeof UpdateOrganizationProfileSchema
>;
export type OrganizationProfileResponseDto = z.infer<
  typeof OrganizationProfileResponseSchema
>;
export type OrganizationMemberListResponseDto = z.infer<
  typeof OrganizationMemberListResponseSchema
>;
