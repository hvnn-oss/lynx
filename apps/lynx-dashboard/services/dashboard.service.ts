import type {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from "@repo/dto";
import { getJson } from "@/lib/api";

const dashboardBasePath = "/v1/observe/dashboard";

export function getDashboardHome(workspaceId: string) {
  return getJson<DashboardHomeMetricsDto>(`${dashboardBasePath}/home`, {
    workspaceId,
  });
}

export function getDashboardStatus(workspaceId: string) {
  return getJson<DashboardStatusMetricsDto>(`${dashboardBasePath}/status`, {
    workspaceId,
  });
}

export function getDashboardMetrics(workspaceId: string) {
  return getJson<DashboardMetricsDataDto>(`${dashboardBasePath}/metrics`, {
    workspaceId,
  });
}

export function getDashboardUsage(workspaceId: string) {
  return getJson<DashboardUsageMetricsDto>(`${dashboardBasePath}/usage`, {
    workspaceId,
  });
}

export function getDashboardCost(workspaceId: string) {
  return getJson<DashboardCostMetricsDto>(`${dashboardBasePath}/cost`, {
    workspaceId,
  });
}

export function getDashboardInsights(workspaceId: string) {
  return getJson<DashboardInsightsDto>(`${dashboardBasePath}/insights`, {
    workspaceId,
  });
}
