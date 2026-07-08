import { KpiCard } from "../../overview/kpi-card";
import DashboardAgentItemHeatmap from "./heatmap";

export default function DashboardAgentItemKpi() {
  return (
    <div className="grid grid-cols-4 grid-rows-2 gap-3 h-fit">
      <DashboardAgentItemHeatmap />
      <KpiCard
        title="마지막 이벤트"
        figure={12}
        unit="초 전"
        subtitle="마지막으로 기록되었습니다."
      />
      <KpiCard
        title="정상 처리율"
        figure={98.3}
        unit="%"
        subtitle="마지막 프롬프트 업데이트 이후"
        ticker="1.5%p"
        tickerUp
      />
      <KpiCard
        title="적용 정책"
        figure={7}
        unit="개"
        subtitle="영향 받는 방화벽 정책"
      />
      <KpiCard
        title="차단된 실행"
        figure={42}
        unit="건"
        subtitle="방화벽에 의해 차단됨"
      />
    </div>
  );
}
