import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugBottleneckDetailPage({
  params,
}: {
  params: Promise<{ bottleneckId: string }>;
}) {
  const { bottleneckId } = await params;
  return <DebugDetailShell kind="bottleneck" id={bottleneckId} />;
}
