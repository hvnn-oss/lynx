"use client";

import type { DashboardHomeMetricsDto } from "@repo/dto";
import { Button } from "@repo/ui/components/ui/button";
import { DashRing } from "@repo/ui/components/ui/dash-ring";
import { RefreshCw } from "lucide-react";
import { FailureTrend } from "@/components/dashboard/home/failure-trend";
import { HealthScore } from "@/components/dashboard/home/health-score";
import { KpiCards } from "@/components/dashboard/home/kpi-cards";
import { RecentIssues } from "@/components/dashboard/home/recent-issues";
import { RunVolume } from "@/components/dashboard/home/run-volume";
import NoDataScreen from "@/components/layouts/dashboard/no-data";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { runtimeConfig } from "@/config/runtime";
import { useDashboardHomeData } from "@/hooks/pages/use-dashboard-home-data";

export function DashboardHomeView() {
  const { query, data } = useDashboardHomeData();
  const isEmpty = data ? isEmptyHomeData(data) : false;

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo breadcrumbs={[{ title: "대시보드", url: "/dashboard" }]} />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
              {runtimeConfig.demoMode ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  Demo data
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              AI 에이전트 서비스의 상태, 사용량, 실패 신호를 한눈에 확인합니다.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <DashRing className="size-4" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            새로고침
          </Button>
        </div>

        {query.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            대시보드 데이터를 불러오지 못했습니다.
          </div>
        ) : null}

        {!query.isLoading && !runtimeConfig.demoMode && isEmpty ? (
          <NoDataScreen />
        ) : null}

        <KpiCards data={data?.kpis} isLoading={query.isLoading} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              에이전트 헬스 스코어
            </h2>
            <HealthScore
              data={data?.healthScores}
              isLoading={query.isLoading}
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <h2 className="mb-3 text-lg font-semibold">시간별 실행량</h2>
            <RunVolume data={data?.runVolume} isLoading={query.isLoading} />
          </div>
          <div className="flex min-w-0 flex-col">
            <h2 className="mb-3 text-lg font-semibold">실패율 추세</h2>
            <FailureTrend
              data={data?.failureTrend}
              isLoading={query.isLoading}
            />
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">최근 이슈</h2>
          <RecentIssues data={data?.recentIssues} isLoading={query.isLoading} />
        </div>
      </div>
    </main>
  );
}

function isEmptyHomeData(data: DashboardHomeMetricsDto): boolean {
  return (
    data.kpis.agentRuns.value === 0 &&
    data.kpis.activeAgents.value === 0 &&
    data.kpis.criticalAlerts.value === 0 &&
    data.healthScores.length === 0 &&
    data.runVolume.length === 0 &&
    data.failureTrend.length === 0 &&
    data.recentIssues.length === 0
  );
}
