import DashboardAgentItemIssues from "./issues";
import DashboardAgentItemKpi from "./kpi";

export default function DashboardAgentItemScreen() {
  return (
    <div className="flex flex-col gap-3">
      <DashboardAgentItemKpi />
      <DashboardAgentItemIssues />
    </div>
  );
}
