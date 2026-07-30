"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Badge,
  Definition,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/ui";
import {
  getAdminOverview,
  getUser,
  updateUserAdminAccess,
} from "@/lib/admin-api";
import type { AdminOverview, AdminUserDetail } from "@/lib/admin-types";
import { formatDate, formatNumber } from "@/lib/format";

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);

  const load = () => {
    setError("");
    Promise.all([getUser(userId), getAdminOverview()])
      .then(([userResult, overviewResult]) => {
        setUser(userResult);
        setOverview(overviewResult);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "사용자 정보를 불러오지 못했습니다.",
        );
      });
  };

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getUser(userId), getAdminOverview()])
      .then(([userResult, overviewResult]) => {
        if (!isCurrent) return;
        setUser(userResult);
        setOverview(overviewResult);
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "사용자 정보를 불러오지 못했습니다.",
        );
      });
    return () => {
      isCurrent = false;
    };
  }, [userId]);

  if (!user && !error) {
    return <LoadingState label="사용자 정보를 불러오는 중입니다." />;
  }
  if (!user) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const hasActiveAdminAccess = user.adminAccess?.isActive === true;
  const isSuperAdmin = user.adminAccess?.role === "SUPER_ADMIN";
  const canManageAdminAccess =
    overview?.currentAdmin.role === "SUPER_ADMIN" && !isSuperAdmin;

  const changeAdminAccess = async () => {
    const nextIsAdmin = !hasActiveAdminAccess;
    const confirmed = window.confirm(
      nextIsAdmin
        ? `${user.name}님에게 Lynx 관리자 권한을 부여할까요?`
        : `${user.name}님의 Lynx 관리자 권한을 해제할까요?`,
    );
    if (!confirmed) return;

    setActionError("");
    setIsUpdatingAccess(true);
    try {
      setUser(await updateUserAdminAccess(user.id, nextIsAdmin));
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "관리자 권한을 변경하지 못했습니다.",
      );
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  return (
    <>
      <PageHeader
        title={user.name}
        description="사용자 계정과 소속, 제품 접근 상태, 운영자 권한을 확인합니다."
        action={
          <Link className="button button-secondary" href="/users">
            목록으로
          </Link>
        }
      />

      <section className="user-detail-heading">
        <UserAvatar
          name={user.name}
          profileImageUrl={user.profileImageUrl}
        />
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <code>{user.id}</code>
        </div>
      </section>

      <div className="detail-summary">
        <div>
          <span>관리자 권한</span>
          <strong>{getAdminRoleLabel(user)}</strong>
          <small>
            {isSuperAdmin
              ? "최상위 운영 권한"
              : hasActiveAdminAccess
                ? "운영 콘솔 접근 가능"
                : "운영 콘솔 접근 불가"}
          </small>
        </div>
        <div>
          <span>참여 범위</span>
          <strong>
            조직 {formatNumber(user.organizationCount)} · 워크스페이스{" "}
            {formatNumber(user.workspaceCount)}
          </strong>
          <small>현재 활성 멤버십 기준</small>
        </div>
        <div>
          <span>가입일</span>
          <strong>{formatDate(user.createdAt)}</strong>
          <small>사용자 계정 생성 시각</small>
        </div>
      </div>

      <Panel
        title="관리자 권한"
        description="권한 변경은 감사 기록에 남으며 활성 슈퍼어드민만 수행할 수 있습니다."
        action={
          canManageAdminAccess ? (
            <button
              className={
                hasActiveAdminAccess
                  ? "button button-secondary"
                  : "button button-primary"
              }
              disabled={isUpdatingAccess}
              onClick={changeAdminAccess}
            >
              {isUpdatingAccess
                ? "변경 중"
                : hasActiveAdminAccess
                  ? "관리자 권한 해제"
                  : "관리자 권한 부여"}
            </button>
          ) : undefined
        }
      >
        <div className="definition-grid">
          <Definition label="현재 권한">
            <AdminAccessBadge user={user} />
          </Definition>
          <Definition label="변경 가능 여부">
            {isSuperAdmin
              ? "슈퍼어드민 보호 대상"
              : overview?.currentAdmin.role === "SUPER_ADMIN"
                ? "변경 가능"
                : "슈퍼어드민 권한 필요"}
          </Definition>
        </div>
        {actionError && <p className="inline-error">{actionError}</p>}
      </Panel>

      <div className="user-detail-grid">
        <Panel title="계정 정보" description="민감한 인증 값은 표시하지 않습니다.">
          <dl className="definition-grid compact">
            <Definition label="이메일">{user.email}</Definition>
            <Definition label="로그인 방식">
              {user.loginProviders.length > 0
                ? user.loginProviders.join(", ")
                : "등록된 로그인 방식 없음"}
            </Definition>
            <Definition label="프로필 이미지">
              {user.profileImageUrl ? "설정됨" : "기본 이미지 사용"}
            </Definition>
          </dl>
        </Panel>

        <Panel title="제품 접근" description="파일럿과 사용자 기본 한도 상태입니다.">
          <dl className="definition-grid compact">
            <Definition label="파일럿 상태">
              {user.pilotAccess ? (
                <Badge tone={getPilotTone(user.pilotAccess.status)}>
                  {getPilotLabel(user.pilotAccess.status)}
                </Badge>
              ) : (
                "별도 파일럿 권한 없음"
              )}
            </Definition>
            <Definition label="사용자 등급">
              {user.entitlement?.tier ?? "기본"}
            </Definition>
            <Definition label="조직 생성 한도">
              {user.entitlement?.maxOwnedOrganizations === null
                ? "무제한"
                : formatNumber(
                    user.entitlement?.maxOwnedOrganizations ?? 0,
                  )}
            </Definition>
            <Definition label="일일 조직 생성">
              {formatNumber(
                user.entitlement?.dailyOrganizationCreateLimit ?? 0,
              )}
            </Definition>
          </dl>
        </Panel>
      </div>

      <Panel
        title="소속 조직"
        description="조직에서 사용자에게 부여된 역할을 표시합니다."
      >
        {user.organizations.length === 0 ? (
          <EmptyState
            title="소속 조직이 없습니다."
            description="아직 조직에 참여하지 않은 사용자입니다."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>조직</th>
                  <th>역할</th>
                  <th>참여일</th>
                  <th aria-label="상세" />
                </tr>
              </thead>
              <tbody>
                {user.organizations.map((organization) => (
                  <tr key={organization.id}>
                    <td>
                      <div className="cell-primary">{organization.name}</div>
                      <code className="cell-code">{organization.id}</code>
                    </td>
                    <td>
                      <Badge>{organization.role}</Badge>
                    </td>
                    <td className="nowrap">
                      {formatDate(organization.joinedAt)}
                    </td>
                    <td>
                      <Link
                        className="table-link"
                        href={`/organizations/${organization.id}`}
                      >
                        조직 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="워크스페이스"
        description="사용자가 직접 참여 중인 워크스페이스와 역할입니다."
      >
        {user.workspaces.length === 0 ? (
          <EmptyState
            title="참여 중인 워크스페이스가 없습니다."
            description="조직 역할만 있고 워크스페이스 멤버십은 없을 수 있습니다."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>워크스페이스</th>
                  <th>조직</th>
                  <th>역할</th>
                  <th>참여일</th>
                </tr>
              </thead>
              <tbody>
                {user.workspaces.map((workspace) => (
                  <tr key={workspace.id}>
                    <td>
                      <div className="cell-primary">{workspace.name}</div>
                      <code className="cell-code">{workspace.id}</code>
                    </td>
                    <td>{workspace.organizationName}</td>
                    <td>
                      <Badge>{workspace.role}</Badge>
                    </td>
                    <td className="nowrap">
                      {formatDate(workspace.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      className={`user-avatar user-avatar-large ${
        profileImageUrl ? "user-avatar-image" : ""
      }`}
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

function AdminAccessBadge({ user }: { user: AdminUserDetail }) {
  if (!user.adminAccess?.isActive) return <Badge>일반 사용자</Badge>;
  if (user.adminAccess.role === "SUPER_ADMIN") {
    return <Badge tone="warning">슈퍼어드민</Badge>;
  }
  return <Badge tone="info">관리자</Badge>;
}

function getAdminRoleLabel(user: AdminUserDetail): string {
  if (!user.adminAccess?.isActive) return "일반 사용자";
  return user.adminAccess.role === "SUPER_ADMIN" ? "슈퍼어드민" : "관리자";
}

function getPilotLabel(status: "ACTIVE" | "SUSPENDED" | "EXPIRED"): string {
  if (status === "ACTIVE") return "활성";
  if (status === "SUSPENDED") return "중지";
  return "만료";
}

function getPilotTone(
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED",
): "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  return "danger";
}
