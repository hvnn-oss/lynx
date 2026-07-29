"use client";

import { useEffect, useState } from "react";
import { AuditTable } from "@/components/audit-table";
import { ErrorState, LoadingState, PageHeader, Panel } from "@/components/ui";
import { listAuditLogs } from "@/lib/admin-api";
import type { AuditLogList } from "@/lib/admin-types";

interface AuditFilters {
  search: string;
  action: string;
  targetType: string;
  from: string;
  to: string;
}

const emptyFilters: AuditFilters = {
  search: "",
  action: "",
  targetType: "",
  from: "",
  to: "",
};

export default function AuditLogsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [data, setData] = useState<AuditLogList | null>(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );

  const load = () => {
    setError("");
    listAuditLogs({
      ...appliedFilters,
      from: appliedFilters.from
        ? new Date(appliedFilters.from).toISOString()
        : undefined,
      to: appliedFilters.to
        ? new Date(appliedFilters.to).toISOString()
        : undefined,
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
    let isCurrent = true;
    listAuditLogs({
      ...appliedFilters,
      from: appliedFilters.from
        ? new Date(appliedFilters.from).toISOString()
        : undefined,
      to: appliedFilters.to
        ? new Date(appliedFilters.to).toISOString()
        : undefined,
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
  }, [appliedFilters, cursor]);

  return (
    <>
      <PageHeader
        title="감사 기록"
        description="누가 무엇을 변경했는지, 실제 요청·응답과 변경 전후 데이터를 확인합니다."
      />
      <Panel>
        <form
          className="filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setCursor(undefined);
            setCursorHistory([]);
            setAppliedFilters(filters);
          }}
        >
          <label className="field field-wide">
            <span>검색</span>
            <input
              placeholder="작업, 대상 ID, 담당자 이름 또는 이메일"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>작업 코드</span>
            <input
              placeholder="prompt.deploy"
              value={filters.action}
              onChange={(event) =>
                setFilters({ ...filters, action: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>대상 종류</span>
            <input
              placeholder="organization_plan"
              value={filters.targetType}
              onChange={(event) =>
                setFilters({ ...filters, targetType: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>시작 시각</span>
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(event) =>
                setFilters({ ...filters, from: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>종료 시각</span>
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(event) =>
                setFilters({ ...filters, to: event.target.value })
              }
            />
          </label>
          <div className="filter-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setFilters(emptyFilters);
                setAppliedFilters(emptyFilters);
                setCursor(undefined);
                setCursorHistory([]);
              }}
            >
              초기화
            </button>
            <button className="button button-primary">적용</button>
          </div>
        </form>
      </Panel>
      <Panel
        title="관리 작업"
        description="최신순으로 표시하며 한 페이지에 최대 25건을 보여줍니다."
      >
        {!data && !error && <LoadingState />}
        {!data && error && <ErrorState message={error} onRetry={load} />}
        {data && <AuditTable items={data.items} />}
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
