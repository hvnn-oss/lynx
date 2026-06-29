import { UsePageInfo } from "@/components/util/set-pageinfo";
import { DebugDetailView } from "@/components/debug/debug-detail-view";
import type { DebugDetailKind } from "@/services/debug-detail-fixtures";

const titleByKind: Record<DebugDetailKind, string> = {
  event: "이벤트 상세",
  trace: "추론 트레이스 상세",
  "tool-call": "도구 호출 상세",
  "llm-call": "LLM 호출 상세",
  error: "에러 상세",
  "root-cause": "원인 분석 상세",
  "failure-pattern": "실패 패턴 상세",
  reproduce: "재현 환경 상세",
  bottleneck: "병목 상세",
  latency: "지연 시간 상세",
  memory: "메모리 상세",
};

export function DebugDetailShell({
  kind,
  id,
}: {
  kind: DebugDetailKind;
  id: string;
}) {
  const title = titleByKind[kind];

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title: "디버깅", url: "/debug/logs" },
          { title, url: "#" },
        ]}
      />
      <DebugDetailView kind={kind} id={id} />
    </main>
  );
}
