import { SessionDetailIssues } from "./issue";
import { SessionDetailKPI } from "./kpi";
import { SessionDetailTimeline } from "./timeline";

export function SessionDetailScreen() {
  return (
    <div>
      <SessionDetailKPI />
      <SessionDetailTimeline />
      <SessionDetailIssues />
    </div>
  );
}
