export const USER_PERMISSIONS = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;

export type UserPermissions =
  (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];

export const WORKSPACE_PERMISSIONS = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;

export type WorkspacePermissions =
  (typeof WORKSPACE_PERMISSIONS)[keyof typeof WORKSPACE_PERMISSIONS];
