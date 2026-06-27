import React from "react";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { InsightList } from "@/components/dashboard/insights/insight-list";

export default function InsightsPage() {
  return (
    <main className="p-6 space-y-6">
      <UsePageInfo 
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title: "인사이트", url: "/dashboard/insights" }
        ]} 
      />
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">인사이트 분석 (Insights)</h1>
            <p className="text-sm text-muted-foreground">단순 로깅을 넘어 시스템의 상태 변화 원인(RCA) 및 주요 병목/이상 현상을 선제적으로 탐지해 제공합니다.</p>
          </div>
        </div>

        {/* 인사이트 목록 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">자동 탐지된 주요 이슈 및 인사이트</h2>
          <InsightList />
        </div>
      </div>
    </main>
  );
}
