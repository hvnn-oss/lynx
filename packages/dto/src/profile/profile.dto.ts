import { z } from "zod";

export const UserProfileResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  profileImageUrl: z.url().nullable(),
});

export const UpdateUserProfileSchema = z.object({
  name: z.string().trim().min(2).max(50),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(8).max(200),
    newPassword: z.string().min(12).max(200),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different.",
    path: ["newPassword"],
  });

export const ProfileImageResponseSchema = z.object({
  profileImageUrl: z.url(),
});

export type UserProfileResponseDto = z.infer<typeof UserProfileResponseSchema>;
export type UpdateUserProfileDto = z.infer<typeof UpdateUserProfileSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ProfileImageResponseDto = z.infer<
  typeof ProfileImageResponseSchema
>;
