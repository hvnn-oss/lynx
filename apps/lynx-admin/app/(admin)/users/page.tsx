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
import { listUsers } from "@/lib/admin-api";
import type {
  AdminRole,
  AdminUserAccessFilter,
  AdminUserList,
} from "@/lib/admin-types";
import { formatDate, formatNumber } from "@/lib/format";

const PAGE_SIZE = "25";

export default function UsersPage() {
  const [data, setData] = useState<AdminUserList | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [access, setAccess] = useState<AdminUserAccessFilter | "">("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );
  const [error, setError] = useState("");

  const resetPagination = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const load = () => {
    setError("");
    listUsers({
      search: appliedSearch || undefined,
      access: access || undefined,
      cursor,
      limit: PAGE_SIZE,
    })
      .then(setData)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "사용자 목록을 불러오지 못했습니다.",
        );
      });
  };

  useEffect(() => {
    let isCurrent = true;
    listUsers({
      search: appliedSearch || undefined,
      access: access || undefined,
      cursor,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (!isCurrent) return;
        setError("");
        setData(result);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "사용자 목록을 불러오지 못했습니다.",
        );
      });
    return () => {
      isCurrent = false;
    };
  }, [access, appliedSearch, cursor]);

  return (
    <>
      <PageHeader
        title="사용자 관리"
        description="가입한 사용자를 검색하고 조직 참여 현황과 Lynx 관리자 권한을 확인합니다."
      />
      <Panel>
        <form
          className="compact-filter"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(search.trim());
            resetPagination();
          }}
        >
          <label className="field field-grow">
            <span>사용자 검색</span>
            <input
              value={search}
              placeholder="이름, 이메일 또는 사용자 ID"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="field">
            <span>관리자 권한</span>
            <select
              value={access}
              onChange={(event) => {
                setAccess(event.target.value as AdminUserAccessFilter | "");
                resetPagination();
              }}
            >
              <option value="">전체 사용자</option>
              <option value="NONE">일반 사용자</option>
              <option value="SUPER_ADMIN">슈퍼어드민</option>
              <option value="SENIOR_ADMIN">상위 관리자</option>
              <option value="ADMIN">일반 관리자</option>
              <option value="VIEWER">뷰어</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            검색
          </button>
        </form>
      </Panel>

      <Panel
        title="사용자 목록"
        description="사용자를 선택하면 로그인 방식, 소속 조직과 워크스페이스, 제품 접근 상태를 확인할 수 있습니다."
      >
        {!data && !error && (
          <LoadingState label="사용자를 불러오는 중입니다." />
        )}
        {!data && error && <ErrorState message={error} onRetry={load} />}
        {data?.items.length === 0 && (
          <EmptyState
            title="조건에 맞는 사용자가 없습니다."
            description="검색어나 관리자 권한 필터를 변경해 보세요."
          />
        )}
        {data && data.items.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>사용자</th>
                  <th>사용자 ID</th>
                  <th>관리자 권한</th>
                  <th>참여 범위</th>
                  <th>가입일</th>
                  <th aria-label="상세" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <UserAvatar
                          name={user.name}
                          profileImageUrl={user.profileImageUrl}
                        />
                        <div>
                          <div className="cell-primary">{user.name}</div>
                          <div className="cell-secondary">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="cell-code user-id">{user.id}</code>
                    </td>
                    <td>
                      <AdminAccessBadge
                        role={user.adminAccess?.role}
                        isActive={user.adminAccess?.isActive}
                      />
                    </td>
                    <td>
                      <div className="cell-primary">
                        조직 {formatNumber(user.organizationCount)}
                      </div>
                      <div className="cell-secondary">
                        워크스페이스 {formatNumber(user.workspaceCount)}
                      </div>
                    </td>
                    <td className="nowrap">{formatDate(user.createdAt)}</td>
                    <td>
                      <Link className="table-link" href={`/users/${user.id}`}>
                        상세 보기
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

function UserAvatar({
  name,
  profileImageUrl,
}: {
  name: string;
  profileImageUrl: string | null;
}) {
  return (
    <span
      aria-label={`${name} 프로필 이미지`}
      className={`user-avatar ${profileImageUrl ? "user-avatar-image" : ""}`}
      role="img"
      style={
        profileImageUrl
          ? { backgroundImage: `url("${profileImageUrl}")` }
          : undefined
      }
    >
      {!profileImageUrl && name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function AdminAccessBadge({
  role,
  isActive,
}: {
  role?: AdminRole;
  isActive?: boolean;
}) {
  if (!role || !isActive) return <Badge>일반 사용자</Badge>;
  if (role === "SUPER_ADMIN") return <Badge tone="warning">슈퍼어드민</Badge>;
  if (role === "SENIOR_ADMIN") {
    return <Badge tone="danger">상위 관리자</Badge>;
  }
  if (role === "ADMIN") return <Badge tone="info">일반 관리자</Badge>;
  return <Badge>뷰어</Badge>;
}
