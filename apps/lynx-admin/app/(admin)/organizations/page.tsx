"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/ui";
import { listOrganizations, listPlans } from "@/lib/admin-api";
import type { AdminPlan, OrganizationList } from "@/lib/admin-types";
import { formatDate, formatNumber } from "@/lib/format";

export default function OrganizationsPage() {
  const [data, setData] = useState<OrganizationList | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [planId, setPlanId] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    listOrganizations({
      search: appliedSearch || undefined,
      planId: planId || undefined,
      cursor,
      limit: "25",
    })
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "조회에 실패했습니다.",
        );
      });
  };

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    let isCurrent = true;
    listOrganizations({
      search: appliedSearch || undefined,
      planId: planId || undefined,
      cursor,
      limit: "25",
    })
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
  }, [appliedSearch, planId, cursor]);

  return (
    <>
      <PageHeader
        title="조직 관리"
        description="고객 조직의 담당자, 규모, 요금제와 월간 사용량을 확인하고 조정합니다."
      />
      <Panel>
        <form
          className="compact-filter"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(search);
            setCursor(undefined);
            setCursorHistory([]);
          }}
        >
          <label className="field field-grow">
            <span>조직 검색</span>
            <input
              placeholder="조직명, 소유자 이름 또는 이메일"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="field">
            <span>요금제</span>
            <select
              value={planId}
              onChange={(event) => {
                setPlanId(event.target.value);
                setCursor(undefined);
                setCursorHistory([]);
              }}
            >
              <option value="">전체 요금제</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary">검색</button>
        </form>
      </Panel>
      <Panel
        title="고객 조직"
        description="조직을 선택하면 워크스페이스, 멤버, 사용량과 감사 기록을 확인할 수 있습니다."
      >
        {!data && !error && <LoadingState />}
        {!data && error && <ErrorState message={error} onRetry={load} />}
        {data?.items.length === 0 && (
          <EmptyState
            title="조건에 맞는 조직이 없습니다."
            description="검색어나 요금제 필터를 바꿔 보세요."
          />
        )}
        {data && data.items.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>조직</th>
                  <th>소유자</th>
                  <th>요금제</th>
                  <th>규모</th>
                  <th>저장 이벤트</th>
                  <th>생성일</th>
                  <th aria-label="상세" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((organization) => (
                  <tr key={organization.id}>
                    <td>
                      <div className="cell-primary">{organization.name}</div>
                      <code className="cell-code">{organization.id}</code>
                    </td>
                    <td>
                      <div className="cell-primary">
                        {organization.owner.name}
                      </div>
                      <div className="cell-secondary">
                        {organization.owner.email}
                      </div>
                    </td>
                    <td>
                      <div className="cell-primary">
                        {formatNumber(organization.storedEventCount)}
                      </div>
                      <div className="cell-secondary">
                        {organization.latestEventAt
                          ? `최근 ${formatDate(organization.latestEventAt)}`
                          : "수집 이력 없음"}
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          organization.plan.isActive ? "success" : "warning"
                        }
                      >
                        {organization.plan.name}
                      </Badge>
                    </td>
                    <td>
                      <div className="cell-primary">
                        워크스페이스 {formatNumber(organization.workspaceCount)}
                      </div>
                      <div className="cell-secondary">
                        멤버 {formatNumber(organization.memberCount)}
                      </div>
                    </td>
                    <td className="nowrap">
                      {formatDate(organization.createdAt)}
                    </td>
                    <td>
                      <Link
                        className="table-link"
                        href={`/organizations/${organization.id}`}
                      >
                        관리
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="pagination">
            <button
              className="button button-secondary"
              disabled={cursorHistory.length === 0}
              onClick={() => {
                const previous = [...cursorHistory];
                const target = previous.pop();
                setCursorHistory(previous);
                setCursor(target);
              }}
            >
              이전
            </button>
            <span>페이지 {cursorHistory.length + 1}</span>
            <button
              className="button button-secondary"
              disabled={!data.nextCursor}
              onClick={() => {
                setCursorHistory([...cursorHistory, cursor]);
                setCursor(data.nextCursor ?? undefined);
              }}
            >
              다음
            </button>
          </div>
        )}
      </Panel>
    </>
  );
}
