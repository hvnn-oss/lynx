import type {
  UserPermissions,
  WorkspacePermissions,
} from "@repo/constants";

export type WorkspaceAccess = {
  organizationId: string;
  organizationRole: UserPermissions;
  workspaceRole: WorkspacePermissions | null;
};
