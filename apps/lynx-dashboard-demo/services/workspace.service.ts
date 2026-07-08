import type {
  CreatedWorkspaceApiKeyDto,
  CreateWorkspaceApiKeyDto,
  CreateOrganizationDto,
  CreateWorkspaceDto,
  OrganizationDetailDto,
  OrganizationSummaryDto,
  UpdateWorkspaceApiKeyDto,
  UpdateWorkspaceDto,
  WorkspaceApiKeyDto,
  WorkspaceApiKeyResponseDto,
  WorkspaceDetailDto,
  WorkspaceSummaryDto,
} from "@repo/dto";
import api, { getJson, postJson } from "@/lib/api";

export function getOrganizations() {
  return getJson<OrganizationSummaryDto[]>("/organization");
}

export function createOrganization(body: CreateOrganizationDto) {
  return postJson<OrganizationDetailDto, CreateOrganizationDto>(
    "/organization",
    body,
  );
}

export function getWorkspaces() {
  return getJson<WorkspaceSummaryDto[]>("/workspace");
}

export function getWorkspace(workspaceId: string) {
  return getJson<WorkspaceDetailDto>(`/workspace/${workspaceId}`);
}

export function createWorkspace(body: CreateWorkspaceDto) {
  return postJson<WorkspaceDetailDto, CreateWorkspaceDto>("/workspace", body);
}

export async function updateWorkspace(
  workspaceId: string,
  body: UpdateWorkspaceDto,
) {
  const response = await api.patch<WorkspaceDetailDto>(
    `/workspace/${workspaceId}`,
    body,
  );
  return response.data;
}

export async function rotateWorkspaceApiKey(workspaceId: string) {
  const response = await api.post<WorkspaceApiKeyResponseDto>(
    `/workspace/${workspaceId}/api-key/rotate`,
  );
  return response.data;
}

export function getWorkspaceApiKeys(workspaceId: string) {
  return getJson<WorkspaceApiKeyDto[]>(`/workspace/${workspaceId}/api-keys`);
}

export function createWorkspaceApiKey(
  workspaceId: string,
  body: CreateWorkspaceApiKeyDto,
) {
  return postJson<CreatedWorkspaceApiKeyDto, CreateWorkspaceApiKeyDto>(
    `/workspace/${workspaceId}/api-keys`,
    body,
  );
}

export async function updateWorkspaceApiKey(
  workspaceId: string,
  apiKeyId: string,
  body: UpdateWorkspaceApiKeyDto,
) {
  const response = await api.patch<WorkspaceApiKeyDto>(
    `/workspace/${workspaceId}/api-keys/${apiKeyId}`,
    body,
  );
  return response.data;
}

export async function revokeWorkspaceApiKey(
  workspaceId: string,
  apiKeyId: string,
) {
  const response = await api.delete<{ success: boolean }>(
    `/workspace/${workspaceId}/api-keys/${apiKeyId}`,
  );
  return response.data;
}
