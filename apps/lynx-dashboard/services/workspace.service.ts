import type {
  CreateOrganizationDto,
  CreateWorkspaceDto,
  OrganizationDetailDto,
  OrganizationSummaryDto,
  UpdateWorkspaceDto,
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
