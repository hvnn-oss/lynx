import { dashboardContract, workspaceContract } from "@repo/contract";
import type {
  CreateWorkspaceDto,
  DashboardAgentsResponseDto,
  DashboardAgentDetailResponseDto,
  DashboardCostResponseDto,
  DashboardIngestionStatusResponseDto,
  DashboardOverviewResponseDto,
  DashboardSessionsResponseDto,
  DashboardSessionDetailResponseDto,
  WorkspaceResponseDto,
  WorkspaceListResponseDto,
} from "@repo/dto";
import { requestContract } from "./api";

export async function listAvailableWorkspaces(): Promise<WorkspaceListResponseDto> {
  return requestContract({
    basePath: workspaceContract.basePath,
    endpoint: workspaceContract.list,
  });
}

/** 선택한 조직에 새 워크스페이스를 생성합니다. */
export async function createWorkspace(
  input: CreateWorkspaceDto,
): Promise<WorkspaceResponseDto> {
  return requestContract({
    basePath: workspaceContract.basePath,
    endpoint: workspaceContract.create,
    request: input,
  });
}

export async function getDashboardOverview(
  workspaceId: string,
): Promise<DashboardOverviewResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getOverview,
    params: { workspaceId },
  });
}

/** 워크스페이스의 실제 Event 저장 상태를 한 번에 조회합니다. */
export async function getDashboardIngestionStatus(
  workspaceId: string,
): Promise<DashboardIngestionStatusResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getIngestionStatus,
    params: { workspaceId },
  });
}

export async function getDashboardCost(
  workspaceId: string,
): Promise<DashboardCostResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getCost,
    params: { workspaceId },
  });
}

export async function getDashboardSessionsOverview(
  workspaceId: string,
): Promise<DashboardSessionsResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getSessionsOverview,
    params: { workspaceId },
  });
}

export async function getDashboardSessionsCompleted(
  workspaceId: string,
): Promise<DashboardSessionsResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getSessionsCompleted,
    params: { workspaceId },
  });
}

export async function getDashboardSessionsFailed(
  workspaceId: string,
): Promise<DashboardSessionsResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getSessionsFailed,
    params: { workspaceId },
  });
}

export async function getDashboardAgentsOverview(
  workspaceId: string,
): Promise<DashboardAgentsResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getAgentsOverview,
    params: { workspaceId },
  });
}

export async function getDashboardAgentsActive(
  workspaceId: string,
): Promise<DashboardAgentsResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getAgentsActive,
    params: { workspaceId },
  });
}

export async function getDashboardAgentsInactive(
  workspaceId: string,
): Promise<DashboardAgentsResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getAgentsInactive,
    params: { workspaceId },
  });
}

export async function getDashboardSessionDetail(
  workspaceId: string,
  id: string,
): Promise<DashboardSessionDetailResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getSessionDetail,
    params: { workspaceId, id },
  });
}

export async function getDashboardAgentDetail(
  workspaceId: string,
  id: string,
): Promise<DashboardAgentDetailResponseDto> {
  return requestContract({
    basePath: dashboardContract.basePath,
    endpoint: dashboardContract.getAgentDetail,
    params: { workspaceId, id },
  });
}
