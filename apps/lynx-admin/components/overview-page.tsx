"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuditTable } from "@/components/audit-table";
import {
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Panel,
} from "@/components/ui";
import { getAdminOverview } from "@/lib/admin-api";
import type { AdminOverview } from "@/lib/admin-types";
import { formatNumber } from "@/lib/format";

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    getAdminOverview()
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        );
      });
  };

  useEffect(() => {
    let isCurrent = true;
    getAdminOverview()
      .then((result) => {
        if (isCurrent) setData(result);
      })
      .catch((cause: unknown) => {
        if (isCurrent) {
          setError(
            cause instanceof Error ? cause.message : "조회에 실패했습니다.",
          );
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (!data && !error) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="운영 요약"
        description="고객 조직, 요금제, 최근 관리 작업을 한 화면에서 확인합니다."
      />
      <section className="metrics-grid">
        <Metric
          label="전체 조직"
          value={formatNumber(data.metrics.organizationCount)}
          hint="현재 등록된 고객 조직"
        />
        <Metric
          label="전체 워크스페이스"
          value={formatNumber(data.metrics.workspaceCount)}
          hint="모든 조직의 합계"
        />
        <Metric
          label="활성 요금제"
          value={formatNumber(data.metrics.activePlanCount)}
          hint="신규 할당 가능한 요금제"
        />
        <Metric
          label="24시간 관리 작업"
          value={formatNumber(data.metrics.auditLogCount24h)}
          hint="성공한 변경 작업"
        />
      </section>
      <section className="overview-grid">
        <Panel
          title="요금제 분포"
          description="어떤 요금제를 몇 개 조직이 사용 중인지 보여줍니다."
          action={
            <Link className="text-link" href="/plans">
              요금제 관리
            </Link>
          }
        >
          <div className="distribution-list">
            {data.planDistribution.map((item) => {
              const ratio =
                data.metrics.organizationCount === 0
                  ? 0
                  : (item.organizationCount / data.metrics.organizationCount) *
                    100;
              return (
                <div key={item.planId} className="distribution-row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.code}</span>
                  </div>
                  <div className="distribution-bar">
                    <span style={{ width: `${Math.max(ratio, 2)}%` }} />
                  </div>
                  <strong>{formatNumber(item.organizationCount)}</strong>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="빠른 작업"
          description="자주 사용하는 운영 작업으로 바로 이동합니다."
        >
          <div className="quick-actions">
            <Link href="/plans?tab=create">
              <strong>새 요금제 추가</strong>
              <span>파일럿·엔터프라이즈 전용 한도 구성</span>
            </Link>
            <Link href="/organizations">
              <strong>조직 요금제 변경</strong>
              <span>고객별 요금제와 현재 사용량 확인</span>
            </Link>
            <Link href="/audit-logs">
              <strong>변경 데이터 확인</strong>
              <span>요청·응답과 변경 전후 데이터 검토</span>
            </Link>
          </div>
        </Panel>
      </section>
      <Panel
        title="최근 감사 기록"
        description="가장 최근에 성공한 관리 작업 5건입니다."
        action={
          <Link className="text-link" href="/audit-logs">
            전체 기록
          </Link>
        }
      >
        <AuditTable items={data.recentAuditLogs} />
      </Panel>
    </>
  );
}
