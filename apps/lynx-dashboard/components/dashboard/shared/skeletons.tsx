"use client";

import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useTranslations } from "next-intl";

export interface CardSkeletonProps {
  className?: string;
  rows?: number;
}

export function CardSkeleton({ className = "", rows = 2 }: CardSkeletonProps) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-background p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        {Array.from({ length: rows - 1 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-1/2" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({
  className = "",
  height = "h-64",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-background p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div
        className={`w-full ${height} flex items-end justify-between gap-2 px-2`}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="w-full rounded-t-sm"
            style={{
              height: `${Math.max(15, Math.floor(Math.random() * 85) + 10)}%`,
              opacity: 0.6 + (i % 3) * 0.15,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  );
}

export function ListSkeleton({
  className = "",
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-background p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-border/10 last:border-0"
          >
            <div className="flex items-center gap-3 w-2/3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 w-full">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatmapSkeleton({ className = "" }: { className?: string }) {
  const t = useTranslations("dashboard.shared");

  return (
    <div
      className={`rounded-lg border border-border/60 bg-background p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-1/4" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(24,1fr)] gap-1.5 overflow-hidden">
        {Array.from({ length: 7 * 24 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-square w-full rounded-sm"
            style={{
              opacity: 0.2 + Math.floor(Math.random() * 5) * 0.2,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <Skeleton className="h-3 w-16" />
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] text-muted-foreground">
            {t("less")}
          </span>
          <Skeleton className="h-3 w-3 rounded-sm" style={{ opacity: 0.2 }} />
          <Skeleton className="h-3 w-3 rounded-sm" style={{ opacity: 0.4 }} />
          <Skeleton className="h-3 w-3 rounded-sm" style={{ opacity: 0.6 }} />
          <Skeleton className="h-3 w-3 rounded-sm" style={{ opacity: 0.8 }} />
          <span className="ml-1 text-[10px] text-muted-foreground">
            {t("more")}
          </span>
        </div>
      </div>
    </div>
  );
}
