import { KpiCard } from "../../dashboard/overview/kpi-card";
import { SessionDetailStatus } from "./status";

export function SessionDetailKPI() {
  return (
    <div className="grid grid-cols-4 gap-2">
      <SessionDetailStatus isRisky />
      <KpiCard title="사용한 토큰" figure={2431} subtitle="토큰을 사용함" />
      <KpiCard
        title="관련된 이슈"
        figure={3}
        unit="개"
        subtitle="의 이슈와 연관됨"
      />
    </div>
  );
}
