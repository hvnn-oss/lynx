import { DashboardDetailShell } from "@/components/dashboard/detail/dashboard-detail-shell";

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ modelName: string }>;
}) {
  const { modelName } = await params;
  return <DashboardDetailShell kind="model" id={modelName} />;
}
