import { ADMIN_ROLE_RANK, type AdminRole } from "@repo/constants";

/** 비활성 관리자나 일반 사용자는 가장 낮은 순위로 취급합니다. */
export function getAdminRoleRank(role: AdminRole | null): number {
  return role ? ADMIN_ROLE_RANK[role] : 0;
}

/** 현재 관리자가 요구되는 최소 역할 이상인지 확인합니다. */
export function hasMinimumAdminRole(
  actorRole: AdminRole | null,
  minimumRole: AdminRole,
): boolean {
  return getAdminRoleRank(actorRole) >= getAdminRoleRank(minimumRole);
}

/**
 * 관리자는 자신보다 낮은 역할만 변경할 수 있습니다.
 * 같은 등급끼리 서로 권한을 회수하는 상황도 막습니다.
 */
export function canManageAdminRole(
  actorRole: AdminRole,
  targetRole: AdminRole | null,
): boolean {
  return getAdminRoleRank(actorRole) > getAdminRoleRank(targetRole);
}

/** 새 역할 역시 현재 관리자보다 낮아야 하며 null은 권한 회수를 뜻합니다. */
export function canAssignAdminRole(
  actorRole: AdminRole,
  nextRole: AdminRole | null,
): boolean {
  return nextRole === null || canManageAdminRole(actorRole, nextRole);
}
