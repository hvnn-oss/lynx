import { USER_PERMISSIONS } from "@repo/constants";
import {
  canAssignOrganizationRole,
  canManageOrganizationMember,
} from "./organization-role.policy.js";

describe("organization role policy", () => {
  it("조직 관리자는 자신보다 낮은 역할만 관리한다", () => {
    expect(
      canManageOrganizationMember(
        USER_PERMISSIONS.ADMIN,
        USER_PERMISSIONS.MEMBER,
      ),
    ).toBe(true);
    expect(
      canManageOrganizationMember(
        USER_PERMISSIONS.ADMIN,
        USER_PERMISSIONS.ADMIN,
      ),
    ).toBe(false);
    expect(
      canManageOrganizationMember(
        USER_PERMISSIONS.ADMIN,
        USER_PERMISSIONS.OWNER,
      ),
    ).toBe(false);
  });

  it("일반 역할 변경으로 Owner를 부여하지 않는다", () => {
    expect(
      canAssignOrganizationRole(USER_PERMISSIONS.OWNER, USER_PERMISSIONS.OWNER),
    ).toBe(false);
    expect(
      canAssignOrganizationRole(USER_PERMISSIONS.OWNER, USER_PERMISSIONS.ADMIN),
    ).toBe(true);
  });
});
