export const ADMIN_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SENIOR_ADMIN: "SENIOR_ADMIN",
  ADMIN: "ADMIN",
  VIEWER: "VIEWER",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

/** 숫자가 클수록 더 높은 플랫폼 관리 권한을 나타냅니다. */
export const ADMIN_ROLE_RANK: Readonly<Record<AdminRole, number>> = {
  [ADMIN_ROLES.SUPER_ADMIN]: 4,
  [ADMIN_ROLES.SENIOR_ADMIN]: 3,
  [ADMIN_ROLES.ADMIN]: 2,
  [ADMIN_ROLES.VIEWER]: 1,
};
