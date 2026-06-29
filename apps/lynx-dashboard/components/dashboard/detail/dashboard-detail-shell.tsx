import { UsePageInfo } from "@/components/util/set-pageinfo";
import { DashboardDetailView } from "@/components/dashboard/detail/dashboard-detail-view";
import type { DashboardDetailKind } from "@/services/dashboard-detail-fixtures";

const titleByKind: Record<DashboardDetailKind, string> = {
  issue: "이슈 상세",
  insight: "인사이트 상세",
  agent: "에이전트 상세",
  tool: "도구 상세",
  model: "모델 상세",
  environment: "환경 상세",
  "cost-anomaly": "비용 이상 상세",
};

export function DashboardDetailShell({
  kind,
  id,
}: {
  kind: DashboardDetailKind;
  id: string;
}) {
  const title = titleByKind[kind];

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title, url: "#" },
        ]}
      />
      <DashboardDetailView kind={kind} id={id} />
    </main>
  );
}
