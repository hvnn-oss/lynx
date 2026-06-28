import type {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from "@repo/dto";
import { getJson } from "@/lib/api";

const demoDashboardBasePath = "/api/v1/demo/dashboard";

export function getDemoDashboardHome() {
  return getJson<DashboardHomeMetricsDto>(`${demoDashboardBasePath}/home`);
}

export function getDemoDashboardStatus() {
  return getJson<DashboardStatusMetricsDto>(`${demoDashboardBasePath}/status`);
}

export function getDemoDashboardMetrics() {
  return getJson<DashboardMetricsDataDto>(`${demoDashboardBasePath}/metrics`);
}

export function getDemoDashboardUsage() {
  return getJson<DashboardUsageMetricsDto>(`${demoDashboardBasePath}/usage`);
}

export function getDemoDashboardCost() {
  return getJson<DashboardCostMetricsDto>(`${demoDashboardBasePath}/cost`);
}

export function getDemoDashboardInsights() {
  return getJson<DashboardInsightsDto>(`${demoDashboardBasePath}/insights`);
}
