import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugToolCallDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <DebugDetailShell kind="tool-call" id={eventId} />;
}
