"use client";

import { HeatmapSkeleton } from "../shared/skeletons";
import { useDashboardUsageData } from "@/hooks/pages/use-dashboard-section-data";
import { cn } from "@/lib/utils";

export function UsageHeatmap() {
  const query = useDashboardUsageData(["dashboard.usage.heatmap"]);

  if (query.isLoading || !query.data) {
    return <HeatmapSkeleton className="w-full" />;
  }

  const max = Math.max(...query.data.heatmap.map((item) => item.count), 1);

  return (
    <div className="rounded-lg border border-border/60 bg-background p-4">
      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1.5 overflow-hidden">
        {query.data.heatmap.map((item) => {
          const intensity = item.count / max;
          return (
            <div
              key={`${item.day}-${item.hour}`}
              title={`${item.day + 1}일차 ${item.hour}시 · ${item.count.toLocaleString("ko-KR")}회`}
              className={cn(
                "aspect-square rounded-sm border border-border/20",
                intensity === 0 && "bg-muted/30",
                intensity > 0 && intensity <= 0.25 && "bg-teal-100",
                intensity > 0.25 && intensity <= 0.5 && "bg-teal-300",
                intensity > 0.5 && intensity <= 0.75 && "bg-teal-500",
                intensity > 0.75 && "bg-teal-700",
              )}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>7일 x 24시간</span>
        <span>최대 {max.toLocaleString("ko-KR")}회</span>
      </div>
    </div>
  );
}
