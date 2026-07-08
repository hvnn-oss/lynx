import { DashboardOverviewIssues } from "./issues";
import { DashboardOverviewKPICard } from "./kpi";

export function DashboardOverviewScreen() {
  return (
    <div>
      <DashboardOverviewKPICard />
      <DashboardOverviewIssues />
    </div>
  );
}
