import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugLatencyDetailPage({
  params,
}: {
  params: Promise<{ bucket: string }>;
}) {
  const { bucket } = await params;
  return <DebugDetailShell kind="latency" id={bucket} />;
}
