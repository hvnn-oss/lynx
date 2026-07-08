import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugRootCauseDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <DebugDetailShell kind="root-cause" id={sessionId} />;
}
