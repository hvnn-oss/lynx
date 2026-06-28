"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getDashboardCost,
  getDashboardHome,
  getDashboardInsights,
  getDashboardMetrics,
  getDashboardStatus,
  getDashboardUsage,
} from "@/services/dashboard.service";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  home: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "home", workspaceId] as const,
  status: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "status", workspaceId] as const,
  metrics: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "metrics", workspaceId] as const,
  usage: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "usage", workspaceId] as const,
  cost: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "cost", workspaceId] as const,
  insights: (workspaceId: string | undefined) =>
    [...dashboardQueryKeys.all, "insights", workspaceId] as const,
};

export function useDashboardHomeQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dashboardQueryKeys.home(workspaceId),
    queryFn: () => getDashboardHome(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboardStatusQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dashboardQueryKeys.status(workspaceId),
    queryFn: () => getDashboardStatus(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboardMetricsQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dashboardQueryKeys.metrics(workspaceId),
    queryFn: () => getDashboardMetrics(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboardUsageQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dashboardQueryKeys.usage(workspaceId),
    queryFn: () => getDashboardUsage(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboardCostQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dashboardQueryKeys.cost(workspaceId),
    queryFn: () => getDashboardCost(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboardInsightsQuery(workspaceId: string | undefined) {
  return useQuery({
    queryKey: dashboardQueryKeys.insights(workspaceId),
    queryFn: () => getDashboardInsights(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useDashboardPageQueries(workspaceId: string | undefined) {
  return useQueries({
    queries: [
      {
        queryKey: dashboardQueryKeys.home(workspaceId),
        queryFn: () => getDashboardHome(workspaceId!),
        enabled: Boolean(workspaceId),
      },
      {
        queryKey: dashboardQueryKeys.status(workspaceId),
        queryFn: () => getDashboardStatus(workspaceId!),
        enabled: Boolean(workspaceId),
      },
      {
        queryKey: dashboardQueryKeys.metrics(workspaceId),
        queryFn: () => getDashboardMetrics(workspaceId!),
        enabled: Boolean(workspaceId),
      },
      {
        queryKey: dashboardQueryKeys.usage(workspaceId),
        queryFn: () => getDashboardUsage(workspaceId!),
        enabled: Boolean(workspaceId),
      },
      {
        queryKey: dashboardQueryKeys.cost(workspaceId),
        queryFn: () => getDashboardCost(workspaceId!),
        enabled: Boolean(workspaceId),
      },
      {
        queryKey: dashboardQueryKeys.insights(workspaceId),
        queryFn: () => getDashboardInsights(workspaceId!),
        enabled: Boolean(workspaceId),
      },
    ],
  });
}
