export const API_KEY_SCOPES = {
  CONFIG_READ: "config:read",
  EVENTS_WRITE: "events:write",
  POLICIES_READ: "policies:read",
  USAGE_READ: "usage:read",
  WORKSPACES_READ: "workspaces:read",
  WORKSPACES_WRITE: "workspaces:write",
} as const;

export type ApiKeyScope =
  (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES];

export const WORKSPACE_API_KEY_KINDS = {
  AUTOMATION: "AUTOMATION",
  INGEST: "INGEST",
  SDK: "SDK",
} as const;

export type WorkspaceApiKeyKind =
  (typeof WORKSPACE_API_KEY_KINDS)[keyof typeof WORKSPACE_API_KEY_KINDS];

export const WORKSPACE_ADMIN_ALLOWED_API_KEY_SCOPES = [
  API_KEY_SCOPES.EVENTS_WRITE,
  API_KEY_SCOPES.CONFIG_READ,
  API_KEY_SCOPES.POLICIES_READ,
] as const;

export const ORGANIZATION_ADMIN_ALLOWED_API_KEY_SCOPES = [
  ...WORKSPACE_ADMIN_ALLOWED_API_KEY_SCOPES,
  API_KEY_SCOPES.WORKSPACES_READ,
  API_KEY_SCOPES.WORKSPACES_WRITE,
  API_KEY_SCOPES.USAGE_READ,
] as const;
