import { UsePageInfo } from "@/components/util/set-pageinfo";
import { KpiCards } from "@/components/dashboard/home/kpi-cards";
import { HealthScore } from "@/components/dashboard/home/health-score";
import { RunVolume } from "@/components/dashboard/home/run-volume";
import { FailureTrend } from "@/components/dashboard/home/failure-trend";
import { RecentIssues } from "@/components/dashboard/home/recent-issues";

export default function DashboardPage() {
  return (
    <main className="p-6 space-y-6">
      <UsePageInfo breadcrumbs={[{ title: "대시보드", url: "/dashboard" }]} />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">대시보드 홈</h1>
          <p className="text-sm text-muted-foreground">AI 에이전트 서비스의 전반적인 상태 및 주요 성능 지표를 한눈에 모니터링합니다.</p>
        </div>

        {/* 상단 KPI 카드 Grid */}
        <KpiCards />

        {/* 중앙 중요 현황 Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">에이전트 헬스 스코어</h2>
            <HealthScore />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">시간별 실행량 (Run Volume)</h2>
            <RunVolume />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">실패율 추세 (Failure Trend)</h2>
            <FailureTrend />
          </div>
        </div>

        {/* 하단 최근 이슈 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">최근 실시간 장애 및 이슈</h2>
          <RecentIssues />
        </div>
      </div>
    </main>
  );
}
