import React from "react";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function InsightList() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div 
          key={i} 
          className="bg-card/30 backdrop-blur-sm border border-border/40 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6 hover:border-primary/20 transition-all duration-300"
        >
          <div className="flex-1 space-y-4">
            {/* Header: Title and Type */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-48 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">원인 (Root Cause)</span>
                <Skeleton className="h-5 w-5/6" />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">영향 (Impact)</span>
                <Skeleton className="h-5 w-4/6" />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">영향받은 Agent (Affected)</span>
                <Skeleton className="h-5 w-3/6" />
              </div>
            </div>
          </div>

          {/* Action button skeleton */}
          <div className="flex items-center shrink-0">
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
