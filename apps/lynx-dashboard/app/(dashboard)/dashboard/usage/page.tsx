import React from "react";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { TopAgents } from "@/components/dashboard/usage/top-agents";
import { UsageHeatmap } from "@/components/dashboard/usage/usage-heatmap";
import { UserUsage } from "@/components/dashboard/usage/user-usage";
import { ToolUsage } from "@/components/dashboard/usage/tool-usage";
import { ModelUsage } from "@/components/dashboard/usage/model-usage";

export default function UsagePage() {
  return (
    <main className="p-6 space-y-6">
      <UsePageInfo 
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title: "사용 현황", url: "/dashboard/usage" }
        ]} 
      />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">사용 현황 (Usage)</h1>
          <p className="text-sm text-muted-foreground">에이전트별 사용 랭킹, 사용자 활동성, 연동 도구 및 LLM 모델별 사용량 지표를 상세 제공합니다.</p>
        </div>

        {/* 최다 사용 에이전트 및 유저 활동 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">최다 활성 에이전트 (Top Agents)</h2>
            <TopAgents />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">워크스페이스 멤버별 활동량 (User Usage)</h2>
            <UserUsage />
          </div>
        </div>

        {/* 시간대별 핫맵 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">요일 및 시간대별 사용량 핫맵 (Usage Heatmap)</h2>
          <UsageHeatmap />
        </div>

        {/* 도구 및 모델 사용량 분포 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">도구별 호출 횟수 (Tool Usage)</h2>
            <ToolUsage />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">LLM 모델별 사용 통계 (Model Usage)</h2>
            <ModelUsage />
          </div>
        </div>
      </div>
    </main>
  );
}
