import { DashboardDetailShell } from "@/components/dashboard/detail/dashboard-detail-shell";

export default async function CostAnomalyDetailPage({
  params,
}: {
  params: Promise<{ anomalyId: string }>;
}) {
  const { anomalyId } = await params;
  return <DashboardDetailShell kind="cost-anomaly" id={anomalyId} />;
}
