import React from "react";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { TotalCost } from "@/components/dashboard/cost/total-cost";
import { CostBreakdown } from "@/components/dashboard/cost/cost-breakdown";
import { CostByAgent } from "@/components/dashboard/cost/cost-by-agent";
import { CostPerRun } from "@/components/dashboard/cost/cost-per-run";
import { CostAnomaly } from "@/components/dashboard/cost/cost-anomaly";

export default function CostPage() {
  return (
    <main className="p-6 space-y-6">
      <UsePageInfo 
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title: "비용 분석", url: "/dashboard/cost" }
        ]} 
      />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">비용 분석 (Cost)</h1>
          <p className="text-sm text-muted-foreground">누적 지출 금액, LLM/도구별 비용 분류, 실행당 비용 분석 및 이상 비용 지출 자동 감지(RCA용)를 지원합니다.</p>
        </div>

        {/* 상단 비용 요약 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">누적 비용 요약 (오늘, 이번주, 이번달)</h2>
          <TotalCost />
        </div>

        {/* 세부 비용 분할 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">비용 세부 항목 분할 (모델/도구/스토리지)</h2>
            <CostBreakdown />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">에이전트별 누적 지출 비용</h2>
            <CostByAgent />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">에이전트 1회 실행당 평균 비용</h2>
            <CostPerRun />
          </div>
        </div>

        {/* 이상 비용 탐지 알림 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">비용 이상 지출 현황 및 경고 (Anomaly Detection)</h2>
          <CostAnomaly />
        </div>
      </div>
    </main>
  );
}
