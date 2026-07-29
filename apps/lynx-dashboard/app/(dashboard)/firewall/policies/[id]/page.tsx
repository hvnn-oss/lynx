import { FirewallPolicyEditor } from "@/components/screen/firewall/policy-editor";

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-full p-5">
      <FirewallPolicyEditor policyId={id} />
    </main>
  );
}
