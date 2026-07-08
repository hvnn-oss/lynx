import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugErrorDetailPage({
  params,
}: {
  params: Promise<{ fingerprint: string }>;
}) {
  const { fingerprint } = await params;
  return <DebugDetailShell kind="error" id={fingerprint} />;
}
