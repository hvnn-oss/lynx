import type {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from "@repo/dto";
import { getJson } from "@/lib/api";
import {
  dashboardDemoCost,
  dashboardDemoHome,
  dashboardDemoInsights,
  dashboardDemoMetrics,
  dashboardDemoStatus,
  dashboardDemoUsage,
} from "@/services/dashboard-demo-fixtures";

const demoDashboardBasePath = "/api/v1/demo/dashboard";

export async function getDemoDashboardHome() {
  return withDemoFallback(
    () => getJson<DashboardHomeMetricsDto>(`${demoDashboardBasePath}/home`),
    dashboardDemoHome,
    isEmptyHome,
  );
}

export async function getDemoDashboardStatus() {
  return withDemoFallback(
    () => getJson<DashboardStatusMetricsDto>(`${demoDashboardBasePath}/status`),
    dashboardDemoStatus,
    isEmptyStatus,
  );
}

export async function getDemoDashboardMetrics() {
  return withDemoFallback(
    () =>
      getJson<DashboardMetricsDataDto>(`${demoDashboardBasePath}/metrics`),
    dashboardDemoMetrics,
    isEmptyMetrics,
  );
}

export async function getDemoDashboardUsage() {
  return withDemoFallback(
    () => getJson<DashboardUsageMetricsDto>(`${demoDashboardBasePath}/usage`),
    dashboardDemoUsage,
    isEmptyUsage,
  );
}

export async function getDemoDashboardCost() {
  return withDemoFallback(
    () => getJson<DashboardCostMetricsDto>(`${demoDashboardBasePath}/cost`),
    dashboardDemoCost,
    isEmptyCost,
  );
}

export async function getDemoDashboardInsights() {
  return withDemoFallback(
    () =>
      getJson<DashboardInsightsDto>(`${demoDashboardBasePath}/insights`),
    dashboardDemoInsights,
    (data) => data.insights.length === 0,
  );
}

async function withDemoFallback<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  isEmpty: (data: T) => boolean,
) {
  try {
    const data = await fetcher();
    return isEmpty(data) ? fallback : data;
  } catch {
    return fallback;
  }
}

function isEmptyStatus(data: DashboardStatusMetricsDto) {
  return (
    data.agentStatus.healthy === 0 &&
    data.agentStatus.warning === 0 &&
    data.agentStatus.critical === 0 &&
    data.agentStatus.offline === 0 &&
    data.modelStatus.length === 0 &&
    data.toolStatus.length === 0 &&
    data.recentOutages.length === 0
  );
}

function isEmptyHome(data: DashboardHomeMetricsDto) {
  return (
    data.kpis.agentRuns.value === 0 &&
    data.healthScores.length === 0 &&
    data.runVolume.length === 0 &&
    data.failureTrend.length === 0 &&
    data.recentIssues.length === 0
  );
}

function isEmptyMetrics(data: DashboardMetricsDataDto) {
  return (
    data.runMetrics.runsPerSec === 0 &&
    data.runMetrics.tokensPerSec === 0 &&
    data.runMetrics.requestsPerSec === 0 &&
    data.agentComparison.length === 0
  );
}

function isEmptyUsage(data: DashboardUsageMetricsDto) {
  return (
    data.topAgents.length === 0 &&
    data.heatmap.length === 0 &&
    data.environmentUsage.length === 0 &&
    data.toolUsage.length === 0 &&
    data.modelUsage.length === 0
  );
}

function isEmptyCost(data: DashboardCostMetricsDto) {
  return (
    data.totalCost.today === 0 &&
    data.totalCost.thisWeek === 0 &&
    data.totalCost.thisMonth === 0 &&
    data.costByAgent.length === 0 &&
    data.costPerRun.timeSeries.length === 0 &&
    data.costAnomalies.length === 0
  );
}
