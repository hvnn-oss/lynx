import { z } from "zod";

const workspaceApiKeyKinds = ["AUTOMATION", "INGEST", "SDK"] as const;
const apiKeyScopes = [
  "config:read",
  "events:write",
  "policies:read",
  "usage:read",
  "workspaces:read",
  "workspaces:write",
] as const;

export const WorkspaceIdParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export const CreateWorkspaceApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  environment: z.enum(["development", "staging", "production"]),
  expirePeriodDays: z.number().int().min(1).max(365).nullable().default(null),
  kind: z.enum(workspaceApiKeyKinds),
  scopes: z.array(z.enum(apiKeyScopes)).min(1),
});

export const CreatedWorkspaceApiKeySchema = z.object({
  id: z.uuid(),
  key: z.string().min(1),
  name: z.string(),
  workspaceId: z.uuid(),
  scopes: z.array(z.enum(apiKeyScopes)),
  expiresAt: z.iso.datetime().nullable(),
});

export type CreateWorkspaceApiKeyDto = z.infer<
  typeof CreateWorkspaceApiKeySchema
>;

export type CreatedWorkspaceApiKeyDto = z.infer<
  typeof CreatedWorkspaceApiKeySchema
>;
