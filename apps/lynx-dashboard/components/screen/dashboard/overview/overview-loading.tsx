import {
  DashboardMetricGrid,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function OverviewLoading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <DashboardMetricGrid>
        {Array.from({ length: 5 }, (_, index) => (
          <DashboardPanel key={index}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-3 w-32" />
          </DashboardPanel>
        ))}
      </DashboardMetricGrid>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <DashboardPanel key={index}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-5 h-64 w-full" />
          </DashboardPanel>
        ))}
      </div>
    </div>
  );
}
