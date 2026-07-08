"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { runtimeConfig } from "@/config/runtime";
import {
  getDashboardCost,
  getDashboardHome,
  getDashboardInsights,
  getDashboardMetrics,
  getDashboardStatus,
  getDashboardUsage,
} from "@/services/dashboard.service";
import {
  getDemoDashboardCost,
  getDemoDashboardHome,
  getDemoDashboardInsights,
  getDemoDashboardMetrics,
  getDemoDashboardStatus,
  getDemoDashboardUsage,
} from "@/services/demo-dashboard.service";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  demo: ["dashboard", "demo"] as const,
  home: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "home", workspaceId] as const,
  demoHome: () => [...dashboardQueryKeys.demo, "home"] as const,
  status: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "status", workspaceId] as const,
  demoStatus: () => [...dashboardQueryKeys.demo, "status"] as const,
  metrics: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "metrics", workspaceId] as const,
  demoMetrics: () => [...dashboardQueryKeys.demo, "metrics"] as const,
  usage: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "usage", workspaceId] as const,
  demoUsage: () => [...dashboardQueryKeys.demo, "usage"] as const,
  cost: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "cost", workspaceId] as const,
  demoCost: () => [...dashboardQueryKeys.demo, "cost"] as const,
  insights: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "insights", workspaceId] as const,
  demoInsights: () => [...dashboardQueryKeys.demo, "insights"] as const,
};

export function useDashboardHomeQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runtimeConfig.demoMode
      ? dashboardQueryKeys.demoHome()
      : dashboardQueryKeys.home(workspaceId),
    queryFn: () =>
      runtimeConfig.demoMode
        ? getDemoDashboardHome()
        : getDashboardHome(workspaceId!),
    enabled: runtimeConfig.demoMode || Boolean(workspaceId),
  });
}

export function useDashboardStatusQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runtimeConfig.demoMode
      ? dashboardQueryKeys.demoStatus()
      : dashboardQueryKeys.status(workspaceId),
    queryFn: () =>
      runtimeConfig.demoMode
        ? getDemoDashboardStatus()
        : getDashboardStatus(workspaceId!),
    enabled: runtimeConfig.demoMode || Boolean(workspaceId),
  });
}

export function useDashboardMetricsQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runtimeConfig.demoMode
      ? dashboardQueryKeys.demoMetrics()
      : dashboardQueryKeys.metrics(workspaceId),
    queryFn: () =>
      runtimeConfig.demoMode
        ? getDemoDashboardMetrics()
        : getDashboardMetrics(workspaceId!),
    enabled: runtimeConfig.demoMode || Boolean(workspaceId),
  });
}

export function useDashboardUsageQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runtimeConfig.demoMode
      ? dashboardQueryKeys.demoUsage()
      : dashboardQueryKeys.usage(workspaceId),
    queryFn: () =>
      runtimeConfig.demoMode
        ? getDemoDashboardUsage()
        : getDashboardUsage(workspaceId!),
    enabled: runtimeConfig.demoMode || Boolean(workspaceId),
  });
}

export function useDashboardCostQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runtimeConfig.demoMode
      ? dashboardQueryKeys.demoCost()
      : dashboardQueryKeys.cost(workspaceId),
    queryFn: () =>
      runtimeConfig.demoMode
        ? getDemoDashboardCost()
        : getDashboardCost(workspaceId!),
    enabled: runtimeConfig.demoMode || Boolean(workspaceId),
  });
}

export function useDashboardInsightsQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: runtimeConfig.demoMode
      ? dashboardQueryKeys.demoInsights()
      : dashboardQueryKeys.insights(workspaceId),
    queryFn: () =>
      runtimeConfig.demoMode
        ? getDemoDashboardInsights()
        : getDashboardInsights(workspaceId!),
    enabled: runtimeConfig.demoMode || Boolean(workspaceId),
  });
}

export function useDashboardPageQueries(workspaceId: string | undefined) {
  return useQueries({
    queries: [
      {
        queryKey: runtimeConfig.demoMode
          ? dashboardQueryKeys.demoHome()
          : dashboardQueryKeys.home(workspaceId),
        queryFn: () =>
          runtimeConfig.demoMode
            ? getDemoDashboardHome()
            : getDashboardHome(workspaceId!),
        enabled: runtimeConfig.demoMode || Boolean(workspaceId),
      },
      {
        queryKey: runtimeConfig.demoMode
          ? dashboardQueryKeys.demoStatus()
          : dashboardQueryKeys.status(workspaceId),
        queryFn: () =>
          runtimeConfig.demoMode
            ? getDemoDashboardStatus()
            : getDashboardStatus(workspaceId!),
        enabled: runtimeConfig.demoMode || Boolean(workspaceId),
      },
      {
        queryKey: runtimeConfig.demoMode
          ? dashboardQueryKeys.demoMetrics()
          : dashboardQueryKeys.metrics(workspaceId),
        queryFn: () =>
          runtimeConfig.demoMode
            ? getDemoDashboardMetrics()
            : getDashboardMetrics(workspaceId!),
        enabled: runtimeConfig.demoMode || Boolean(workspaceId),
      },
      {
        queryKey: runtimeConfig.demoMode
          ? dashboardQueryKeys.demoUsage()
          : dashboardQueryKeys.usage(workspaceId),
        queryFn: () =>
          runtimeConfig.demoMode
            ? getDemoDashboardUsage()
            : getDashboardUsage(workspaceId!),
        enabled: runtimeConfig.demoMode || Boolean(workspaceId),
      },
      {
        queryKey: runtimeConfig.demoMode
          ? dashboardQueryKeys.demoCost()
          : dashboardQueryKeys.cost(workspaceId),
        queryFn: () =>
          runtimeConfig.demoMode
            ? getDemoDashboardCost()
            : getDashboardCost(workspaceId!),
        enabled: runtimeConfig.demoMode || Boolean(workspaceId),
      },
      {
        queryKey: runtimeConfig.demoMode
          ? dashboardQueryKeys.demoInsights()
          : dashboardQueryKeys.insights(workspaceId),
        queryFn: () =>
          runtimeConfig.demoMode
            ? getDemoDashboardInsights()
            : getDashboardInsights(workspaceId!),
        enabled: runtimeConfig.demoMode || Boolean(workspaceId),
      },
    ],
  });
}
