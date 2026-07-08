import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugLlmCallDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <DebugDetailShell kind="llm-call" id={eventId} />;
}
