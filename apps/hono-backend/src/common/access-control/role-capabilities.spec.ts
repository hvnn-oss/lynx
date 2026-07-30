import { USER_PERMISSIONS } from "@repo/constants";
import { CAPABILITIES } from "./capabilities.js";
import { ORGANIZATION_ROLE_CAPABILITIES } from "./role-capabilities.js";

describe("organization role capabilities", () => {
  it("Owner와 Admin은 조직 삭제와 멤버 관리를 수행할 수 있다", () => {
    for (const role of [USER_PERMISSIONS.OWNER, USER_PERMISSIONS.ADMIN]) {
      expect(
        ORGANIZATION_ROLE_CAPABILITIES[role].has(
          CAPABILITIES.ORGANIZATION_DELETE,
        ),
      ).toBe(true);
      expect(
        ORGANIZATION_ROLE_CAPABILITIES[role].has(
          CAPABILITIES.ORGANIZATION_MEMBER_MANAGE,
        ),
      ).toBe(true);
    }
  });

  it("Owner 위임은 Owner 역할에만 허용한다", () => {
    expect(
      ORGANIZATION_ROLE_CAPABILITIES[USER_PERMISSIONS.OWNER].has(
        CAPABILITIES.ORGANIZATION_OWNER_TRANSFER,
      ),
    ).toBe(true);
    expect(
      ORGANIZATION_ROLE_CAPABILITIES[USER_PERMISSIONS.ADMIN].has(
        CAPABILITIES.ORGANIZATION_OWNER_TRANSFER,
      ),
    ).toBe(false);
  });
});
