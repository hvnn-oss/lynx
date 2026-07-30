import { ADMIN_ROLES } from "@repo/constants";
import {
  canAssignAdminRole,
  canManageAdminRole,
  hasMinimumAdminRole,
} from "./admin-role.policy.js";

describe("admin role policy", () => {
  it("상위 관리자는 일반 관리자와 뷰어만 관리한다", () => {
    expect(
      canManageAdminRole(ADMIN_ROLES.SENIOR_ADMIN, ADMIN_ROLES.ADMIN),
    ).toBe(true);
    expect(
      canManageAdminRole(ADMIN_ROLES.SENIOR_ADMIN, ADMIN_ROLES.SENIOR_ADMIN),
    ).toBe(false);
    expect(
      canAssignAdminRole(ADMIN_ROLES.SENIOR_ADMIN, ADMIN_ROLES.SUPER_ADMIN),
    ).toBe(false);
  });

  it("뷰어는 일반 관리자 수준의 변경 권한을 충족하지 않는다", () => {
    expect(hasMinimumAdminRole(ADMIN_ROLES.VIEWER, ADMIN_ROLES.ADMIN)).toBe(
      false,
    );
    expect(
      hasMinimumAdminRole(ADMIN_ROLES.SENIOR_ADMIN, ADMIN_ROLES.ADMIN),
    ).toBe(true);
  });
});
