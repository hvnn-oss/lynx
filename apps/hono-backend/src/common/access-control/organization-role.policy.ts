import { USER_PERMISSIONS, type UserPermissions } from "@repo/constants";

const ORGANIZATION_ROLE_RANK: Readonly<Record<UserPermissions, number>> = {
  [USER_PERMISSIONS.OWNER]: 4,
  [USER_PERMISSIONS.ADMIN]: 3,
  [USER_PERMISSIONS.MEMBER]: 2,
  [USER_PERMISSIONS.VIEWER]: 1,
};

/** 멤버 권한 관리는 조직 Owner와 Admin에게만 허용합니다. */
export function canManageOrganizationMember(
  actorRole: UserPermissions,
  targetRole: UserPermissions,
): boolean {
  const isManager =
    actorRole === USER_PERMISSIONS.OWNER ||
    actorRole === USER_PERMISSIONS.ADMIN;
  return (
    isManager &&
    ORGANIZATION_ROLE_RANK[actorRole] > ORGANIZATION_ROLE_RANK[targetRole]
  );
}

/** Owner 역할은 별도 위임 흐름에서만 설정하고 일반 변경에서는 제외합니다. */
export function canAssignOrganizationRole(
  actorRole: UserPermissions,
  nextRole: UserPermissions,
): boolean {
  return (
    nextRole !== USER_PERMISSIONS.OWNER &&
    ORGANIZATION_ROLE_RANK[actorRole] >= ORGANIZATION_ROLE_RANK[nextRole]
  );
}
