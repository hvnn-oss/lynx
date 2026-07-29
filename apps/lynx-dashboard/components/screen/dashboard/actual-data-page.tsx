"use client";

import {
  DashboardChartPanel,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { RefreshCw } from "lucide-react";

export function ActualDataBarChart({
  title,
  description,
  emptyText,
  items,
  colorClassName = "bg-blue-500",
  formatValue = String,
}: {
  title: string;
  description: string;
  emptyText: string;
  items: Array<{ key: string; label: string; value: number }>;
  colorClassName?: string;
  formatValue?: (value: number) => string;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.value));

  return (
    <DashboardChartPanel
      empty={items.length === 0 || items.every((item) => item.value === 0)}
      emptyText={emptyText}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-6 flex h-56 items-end gap-2">
        {items.map((item) => (
          <div
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            key={item.key}
          >
            <span className="text-[10px] font-medium tabular-nums">
              {formatValue(item.value)}
            </span>
            <div
              className={`${colorClassName} w-full rounded-t-sm`}
              style={{
                height: `${Math.max(4, Math.round((item.value / maximum) * 160))}px`,
              }}
            />
            <span className="max-w-full truncate text-[10px] text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </DashboardChartPanel>
  );
}

export function ActualDataPageLoading() {
  return (
    <div className="space-y-8 p-20" aria-busy="true">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <DashboardMetricGrid>
        {Array.from({ length: 5 }, (_, index) => (
          <DashboardPanel key={index}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-32" />
          </DashboardPanel>
        ))}
      </DashboardMetricGrid>
      <div className="grid gap-8 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <DashboardPanel key={index}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-56 w-full" />
          </DashboardPanel>
        ))}
      </div>
    </div>
  );
}

export function ActualDataPageMessage({
  title,
  description,
  pageTitle,
  pageDescription,
  action,
  onRetry,
}: {
  title: string;
  description: string;
  pageTitle: string;
  pageDescription: string;
  action?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="space-y-8">
      <DashboardPageHeader title={pageTitle} description={pageDescription} />
      <DashboardPanel className="flex min-h-56 flex-col items-center justify-center text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          {description}
        </p>
        {action && onRetry ? (
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={onRetry}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {action}
          </Button>
        ) : null}
      </DashboardPanel>
    </div>
  );
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return "-";
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  return `${(milliseconds / 1_000).toFixed(1)}s`;
}
