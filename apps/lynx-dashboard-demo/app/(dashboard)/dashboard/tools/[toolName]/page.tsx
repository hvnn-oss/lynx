import { DashboardDetailShell } from "@/components/dashboard/detail/dashboard-detail-shell";

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ toolName: string }>;
}) {
  const { toolName } = await params;
  return <DashboardDetailShell kind="tool" id={toolName} />;
}
