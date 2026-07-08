import { DashboardDetailShell } from "@/components/dashboard/detail/dashboard-detail-shell";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  return <DashboardDetailShell kind="issue" id={issueId} />;
}
