import { SessionDetailShell } from "@/components/session/session-detail-shell";

export default async function SessionTimelineDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SessionDetailShell sessionId={sessionId} />;
}
