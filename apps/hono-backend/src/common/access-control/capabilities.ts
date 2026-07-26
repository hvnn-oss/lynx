export const CAPABILITIES = {
  ORGANIZATION_READ: "organization:read",
  ORGANIZATION_UPDATE: "organization:update",
  WORKSPACE_CREATE: "workspace:create",
  WORKSPACE_READ: "workspace:read",
  WORKSPACE_UPDATE: "workspace:update",
  WORKSPACE_DELETE: "workspace:delete",
  WORKSPACE_API_KEY_LIST: "workspace-api-key:list",
  WORKSPACE_API_KEY_CREATE: "workspace-api-key:create",
  WORKSPACE_API_KEY_REVOKE: "workspace-api-key:revoke",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
