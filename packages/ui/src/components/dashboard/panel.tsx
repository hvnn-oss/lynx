"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Separator } from "../ui/separator";

type DashboardTone = "neutral" | "good" | "warning" | "bad";

export interface CappedItemsResult<T> {
  items: T[];
  hiddenCount: number;
  hasMore: boolean;
}

export function getCappedItems<T>(
  items: T[] | undefined,
  limit: number,
): CappedItemsResult<T> {
  const source = items ?? [];
  const safeLimit = Math.max(0, limit);
  const visibleItems = source.slice(0, safeLimit);

  return {
    items: visibleItems,
    hiddenCount: Math.max(0, source.length - visibleItems.length),
    hasMore: source.length > visibleItems.length,
  };
}

export function DashboardPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardPageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-normal">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function DashboardSectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-normal">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function DashboardMetricGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-5", className)}>
      {children}
    </div>
  );
}

export function DashboardMetricCard({
  label,
  value,
  description,
  tone = "neutral",
}: {
  label: string;
  value: string;
  description?: string;
  tone?: DashboardTone;
}) {
  return (
    <DashboardPanel>
      <p className="truncate text-sm font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 truncate text-2xl font-semibold tracking-normal">
        {value}
      </p>
      {description ? (
        <p
          className={cn(
            "mt-2 truncate text-xs font-medium",
            getToneClass(tone),
          )}
        >
          {description}
        </p>
      ) : null}
    </DashboardPanel>
  );
}

export function DashboardListPanel({
  children,
  empty,
  emptyText = "No data available.",
  footer,
  className,
}: {
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DashboardPanel className={className}>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
      {!empty && footer ? <div className="pt-2">{footer}</div> : null}
    </DashboardPanel>
  );
}

export function DashboardListRow({
  title,
  description,
  value,
  tone = "neutral",
  markerClassName,
}: {
  title: string;
  description?: string;
  value?: string;
  tone?: DashboardTone;
  markerClassName?: string;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/30">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-sm bg-muted-foreground/40",
            markerClassName,
          )}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {value ? (
        <p
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            getToneClass(tone),
          )}
        >
          {value}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardRowSeparator() {
  return <Separator className="bg-border/40" />;
}

export function DashboardMoreRow({
  hiddenCount,
  label,
}: {
  hiddenCount: number;
  label: string;
}) {
  if (hiddenCount <= 0) return null;

  return (
    <p className="border-t border-border/40 pt-3 text-center text-xs font-medium text-muted-foreground">
      {label}
    </p>
  );
}

export function DashboardChartPanel({
  children,
  empty,
  emptyText = "No chart data available.",
  className,
}: {
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
  className?: string;
}) {
  return (
    <DashboardPanel className={className}>
      {empty ? (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        children
      )}
    </DashboardPanel>
  );
}

function getToneClass(tone: DashboardTone) {
  if (tone === "good") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "bad") return "text-rose-700";
  return "text-muted-foreground";
}
