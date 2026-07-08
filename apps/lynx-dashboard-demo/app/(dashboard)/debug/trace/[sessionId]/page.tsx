import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugTraceDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <DebugDetailShell kind="trace" id={sessionId} />;
}
