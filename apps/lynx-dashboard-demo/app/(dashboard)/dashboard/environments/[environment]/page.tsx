import { DashboardDetailShell } from "@/components/dashboard/detail/dashboard-detail-shell";

export default async function EnvironmentDetailPage({
  params,
}: {
  params: Promise<{ environment: string }>;
}) {
  const { environment } = await params;
  return <DashboardDetailShell kind="environment" id={environment} />;
}
