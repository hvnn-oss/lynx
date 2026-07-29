import { DashboardAgentDetailScreen } from "@/components/screen/dashboard/details";

export default async function DashboardAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DashboardAgentDetailScreen id={id} />;
}
