import { DashboardSessionDetailScreen } from "@/components/screen/dashboard/details";

export default async function DashboardSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DashboardSessionDetailScreen id={id} />;
}
