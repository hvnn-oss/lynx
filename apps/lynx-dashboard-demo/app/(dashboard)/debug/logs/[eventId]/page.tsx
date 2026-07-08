import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <DebugDetailShell kind="event" id={eventId} />;
}
