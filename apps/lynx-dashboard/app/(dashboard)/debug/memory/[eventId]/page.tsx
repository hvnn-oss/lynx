import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugMemoryDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <DebugDetailShell kind="memory" id={eventId} />;
}
