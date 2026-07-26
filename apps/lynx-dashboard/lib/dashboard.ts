import { dashboardContract, workspaceContract } from "@repo/contract";
import type {
  DashboardOverviewResponseDto,
  WorkspaceListResponseDto,
} from "@repo/dto";
import { requestContract } from "./api";

export async function listAvailableWorkspaces(): Promise<WorkspaceListResponseDto> {
  return requestContract({
    basePath: workspaceContract.basePath,
    endpoint: workspaceContract.list,
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
