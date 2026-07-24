import type {
  ApiKeyScope,
  WorkspaceApiKeyKind,
} from "@repo/constants";

export type CreateWorkspaceRecordInput = {
  userId: string;
  orgId: string;
  name: string;
};

export type CreateWorkspaceApiKeyInput = {
  userId: string;
  workspaceId: string;
  name: string;
  environment: ApiKeyEnvironment;
  expirePeriodDays: number | null;
  kind: WorkspaceApiKeyKind;
  scopes: ApiKeyScope[];
};

export type CreateWorkspaceApiKeyRecordInput = {
  userId: string;
  workspaceId: string;
  name: string;
  id: string;
  keyHash: string;
  prefix: string;
  expiresAt: Date | null;
  kind: WorkspaceApiKeyKind;
  scopes: ApiKeyScope[];
};

export type ApiKeyEnvironment = "development" | "staging" | "production";

export type CreatedWorkspaceApiKey = {
  id: string;
  key: string;
  name: string;
  workspaceId: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
};
