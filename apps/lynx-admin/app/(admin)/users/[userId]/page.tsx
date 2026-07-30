"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  deleteUser,
  updateUserAdminAccess,
} from "@/lib/admin-api";
import type {
  AdminOverview,
  AdminRole,
  AdminUserDetail,
} from "@/lib/admin-types";
import { formatDate, formatNumber } from "@/lib/format";

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
  const targetRole = hasActiveAdminAccess
    ? (user.adminAccess?.role ?? null)
    : null;
  const actorRole = overview?.currentAdmin.role ?? null;
  const canManageAdminAccess =
    actorRole !== null &&
    getAdminRoleRank(actorRole) >= getAdminRoleRank("ADMIN") &&
    getAdminRoleRank(actorRole) > getAdminRoleRank(targetRole);
  const canDeleteUser =
    actorRole !== null &&
    getAdminRoleRank(actorRole) >= getAdminRoleRank("SENIOR_ADMIN") &&
    !hasActiveAdminAccess;

  const changeAdminAccess = async (nextRole: AdminRole | null) => {
    if (nextRole === targetRole) return;
    const confirmed = window.confirm(
      nextRole
        ? `${user.name}님의 플랫폼 권한을 ${getAdminRoleLabelValue(nextRole)}(으)로 변경할까요?`
        : `${user.name}님의 Lynx 관리자 권한을 해제할까요?`,
    );
    if (!confirmed) return;

    setActionError("");
    setIsUpdatingAccess(true);
    try {
      setUser(await updateUserAdminAccess(user.id, nextRole));
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
        <UserAvatar name={user.name} profileImageUrl={user.profileImageUrl} />
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
            {hasActiveAdminAccess
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
        description="관리자는 자신보다 낮은 등급만 변경할 수 있으며 모든 변경은 감사 기록에 남습니다."
        action={
          canManageAdminAccess ? (
            <select
              className="button button-secondary"
              value={targetRole ?? "NONE"}
              disabled={isUpdatingAccess}
              onChange={(event) =>
                void changeAdminAccess(
                  event.target.value === "NONE"
                    ? null
                    : (event.target.value as AdminRole),
                )
              }
            >
              <option value="NONE">관리자 권한 없음</option>
              {getAssignableAdminRoles(actorRole).map((role) => (
                <option key={role} value={role}>
                  {getAdminRoleLabelValue(role)}
                </option>
              ))}
            </select>
          ) : undefined
        }
      >
        <div className="definition-grid">
          <Definition label="현재 권한">
            <AdminAccessBadge user={user} />
          </Definition>
          <Definition label="변경 가능 여부">
            {canManageAdminAccess
              ? "변경 가능"
              : "동일하거나 높은 등급은 변경할 수 없음"}
          </Definition>
        </div>
        {actionError && <p className="inline-error">{actionError}</p>}
      </Panel>

      {canDeleteUser ? (
        <Panel
          title="사용자 삭제"
          description="사용자 계정과 사용자가 소유한 조직 및 하위 데이터가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        >
          <label className="field">
            <span>확인을 위해 사용자 이메일을 입력하세요.</span>
            <input
              value={deleteConfirmation}
              placeholder={user.email}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
          </label>
          {deleteError ? <p className="inline-error">{deleteError}</p> : null}
          <div className="panel-actions">
            <button
              className="button button-danger"
              disabled={
                isDeleting ||
                deleteConfirmation.trim().toLowerCase() !==
                  user.email.toLowerCase()
              }
              onClick={async () => {
                setDeleteError("");
                setIsDeleting(true);
                try {
                  await deleteUser(user.id, deleteConfirmation);
                  router.push("/users");
                } catch (cause) {
                  setDeleteError(
                    cause instanceof Error
                      ? cause.message
                      : "사용자를 삭제하지 못했습니다.",
                  );
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "삭제 중" : "사용자 영구 삭제"}
            </button>
          </div>
        </Panel>
      ) : null}

      <div className="user-detail-grid">
        <Panel
          title="계정 정보"
          description="민감한 인증 값은 표시하지 않습니다."
        >
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

        <Panel
          title="제품 접근"
          description="파일럿과 사용자 기본 한도 상태입니다."
        >
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
                : formatNumber(user.entitlement?.maxOwnedOrganizations ?? 0)}
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
                    <td className="nowrap">{formatDate(workspace.joinedAt)}</td>
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
  if (user.adminAccess.role === "SENIOR_ADMIN") {
    return <Badge tone="danger">상위 관리자</Badge>;
  }
  if (user.adminAccess.role === "ADMIN") {
    return <Badge tone="info">일반 관리자</Badge>;
  }
  return <Badge>뷰어</Badge>;
}

function getAdminRoleLabel(user: AdminUserDetail): string {
  if (!user.adminAccess?.isActive) return "일반 사용자";
  return getAdminRoleLabelValue(user.adminAccess.role);
}

function getAdminRoleLabelValue(role: AdminRole): string {
  if (role === "SUPER_ADMIN") return "슈퍼어드민";
  if (role === "SENIOR_ADMIN") return "상위 관리자";
  if (role === "ADMIN") return "일반 관리자";
  return "뷰어";
}

function getAdminRoleRank(role: AdminRole | null): number {
  if (role === "SUPER_ADMIN") return 4;
  if (role === "SENIOR_ADMIN") return 3;
  if (role === "ADMIN") return 2;
  if (role === "VIEWER") return 1;
  return 0;
}

function getAssignableAdminRoles(actorRole: AdminRole | null): AdminRole[] {
  if (!actorRole) return [];
  return (["SENIOR_ADMIN", "ADMIN", "VIEWER"] as const).filter(
    (role) => getAdminRoleRank(actorRole) > getAdminRoleRank(role),
  );
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
