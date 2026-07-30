import {
  ACCESS_INVITATION_STATUS,
  PRODUCT_ACCESS_MODE,
  PRODUCT_ACCESS_STATUS,
} from "@repo/constants";
import { z } from "zod";

export const SignupPolicyResponseSchema = z.object({
  mode: z.enum(PRODUCT_ACCESS_MODE),
  requiresInvitation: z.boolean(),
});

export const ProductAccessContextSchema = z.object({
  mode: z.enum(PRODUCT_ACCESS_MODE),
  status: z.enum(PRODUCT_ACCESS_STATUS),
  canUseProduct: z.boolean(),
  canCreateWorkspace: z.boolean(),
  reason: z.string().nullable(),
});

export const CreateAccessInvitationSchema = z.object({
  email: z.email(),
  organizationPlanId: z.uuid().optional(),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
});

export const AccessInvitationIdParamsSchema = z.object({
  invitationId: z.uuid(),
});

export const ListAccessInvitationsQuerySchema = z.object({
  status: z.enum(ACCESS_INVITATION_STATUS).optional(),
  cursor: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/i,
      "Invalid access invitation cursor.",
    )
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const AccessInvitationResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  organizationPlanId: z.uuid().nullable(),
  status: z.enum(ACCESS_INVITATION_STATUS),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const AccessInvitationListResponseSchema = z.object({
  items: z.array(AccessInvitationResponseSchema),
  nextCursor: z.string().nullable(),
});

export type SignupPolicyResponseDto = z.infer<
  typeof SignupPolicyResponseSchema
>;
export type ProductAccessContextDto = z.infer<
  typeof ProductAccessContextSchema
>;
export type CreateAccessInvitationDto = z.infer<
  typeof CreateAccessInvitationSchema
>;
export type ListAccessInvitationsQueryDto = z.infer<
  typeof ListAccessInvitationsQuerySchema
>;
export type AccessInvitationResponseDto = z.infer<
  typeof AccessInvitationResponseSchema
>;
