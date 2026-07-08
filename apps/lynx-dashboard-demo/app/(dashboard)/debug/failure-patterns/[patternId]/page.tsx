import { DebugDetailShell } from "@/components/debug/debug-detail-shell";

export default async function DebugFailurePatternDetailPage({
  params,
}: {
  params: Promise<{ patternId: string }>;
}) {
  const { patternId } = await params;
  return <DebugDetailShell kind="failure-pattern" id={patternId} />;
}
