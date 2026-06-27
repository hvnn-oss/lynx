import React from "react";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { RunMetrics } from "@/components/dashboard/metrics/run-metrics";
import { LatencyDistribution } from "@/components/dashboard/metrics/latency-distribution";
import { TokenMetrics } from "@/components/dashboard/metrics/token-metrics";
import { ErrorRateDistribution } from "@/components/dashboard/metrics/error-rate-distribution";
import { AgentComparison } from "@/components/dashboard/metrics/agent-comparison";

export default function MetricsPage() {
  return (
    <main className="p-6 space-y-6">
      <UsePageInfo 
        breadcrumbs={[
          { title: "대시보드", url: "/dashboard" },
          { title: "주요 지표", url: "/dashboard/metrics" }
        ]} 
      />
      
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">주요 지표 (Metrics)</h1>
          <p className="text-sm text-muted-foreground">AI 에이전트 실행 횟수, 처리 속도, 응답 속도 및 에러율 분포 등 딥 옵저버빌리티 지표들을 모니터링합니다.</p>
        </div>

        {/* 실행량 실시간 성능 메트릭 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">실시간 실행 성능 (Runs/sec, Tokens/sec)</h2>
          <RunMetrics />
        </div>

        {/* 성능 상세 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">지연 시간 분포 (Latency P50/P95/P99)</h2>
            <LatencyDistribution />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">토큰 사용 비율 (Input vs Output)</h2>
            <TokenMetrics />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-3">에러 원인별 분포 (Tool/LLM/Validation)</h2>
            <ErrorRateDistribution />
          </div>
        </div>

        {/* 에이전트별 성능 비교 */}
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold mb-3">에이전트별 상세 성능 비교</h2>
          <AgentComparison />
        </div>
      </div>
    </main>
  );
}
