import { PolicyDetailScreen } from "@/components/screen/firewall/operations";

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-full p-5">
      <PolicyDetailScreen policyId={id} />
    </main>
  );
}
