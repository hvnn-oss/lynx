import { DashboardDetailShell } from "@/components/dashboard/detail/dashboard-detail-shell";

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ insightId: string }>;
}) {
  const { insightId } = await params;
  return <DashboardDetailShell kind="insight" id={insightId} />;
}
