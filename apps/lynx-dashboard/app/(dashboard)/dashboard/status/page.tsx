import React from "react";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { AgentStatus } from "@/components/dashboard/status/agent-status";
import { ModelStatus } from "@/components/dashboard/status/model-status";
import { ToolStatus } from "@/components/dashboard/status/tool-status";
import { RecentOutages } from "@/components/dashboard/status/recent-outages";
import { SloStatus } from "@/components/dashboard/status/slo-status";

export default function StatusPage() {
  return (
    <main className="p-6 space-y-6">
      <UsePageInfo 
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title: "시스템 상태", url: "/dashboard/status" }
        ]} 
      />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">시스템 상태 (Status)</h1>
          <p className="text-sm text-muted-foreground">AI 에이전트, 서브 모델 및 사용 도구들의 연동 상태와 가동률(SLO)을 확인합니다.</p>
        </div>

        {/* 에이전트 상태 개요 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">에이전트 가동 상태</h2>
          <AgentStatus />
        </div>

        {/* SLO 및 가동 타겟 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col">
            <h2 className="text-lg font-semibold mb-3">최근 시스템 장애 / 타임아웃 로그</h2>
            <RecentOutages />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">서비스 가동률 (SLO)</h2>
            <SloStatus />
          </div>
        </div>

        {/* 모델 및 도구 현황 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">연동 LLM 모델 성공률</h2>
            <ModelStatus />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">SaaS 및 데이터베이스 도구 성공률</h2>
            <ToolStatus />
          </div>
        </div>
      </div>
    </main>
  );
}
