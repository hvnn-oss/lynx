export const USER_PERMISSIONS = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type UserPermissions =
  (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];
