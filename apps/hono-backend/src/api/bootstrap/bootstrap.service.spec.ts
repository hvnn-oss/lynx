import { randomUUID } from "node:crypto";
import type { OrganizationService } from "../organization/organization.service.js";
import type { ProfileService } from "../profile/profile.service.js";
import type { WorkspaceService } from "../workspace/workspace.service.js";
import type { ProductAccessService } from "../../common/access-control/product-access.service.js";
import { BootstrapService } from "./bootstrap.service.js";

describe("BootstrapService", () => {
  it("사용자, 조직, 워크스페이스를 하나의 컨텍스트로 반환한다", async () => {
    const userId = randomUUID();
    const organizationId = randomUUID();
    const workspaceId = randomUUID();
    const user = {
      id: userId,
      email: "user@example.com",
      name: "Lynx User",
      profileImageUrl: "https://images.example.com/default-user.png",
    };
    const organization = {
      id: organizationId,
      name: "Lynx",
      profileImageUrl: "https://images.example.com/default-organization.png",
      role: "OWNER" as const,
    };
    const workspace = {
      id: workspaceId,
      name: "Production",
      orgId: organizationId,
    };
    const profiles = {
      getProfile: jest.fn().mockResolvedValue(user),
    } as unknown as ProfileService;
    const organizations = {
      listOrganizations: jest.fn().mockResolvedValue({ items: [organization] }),
    } as unknown as OrganizationService;
    const workspaces = {
      listWorkspaces: jest.fn().mockResolvedValue({ items: [workspace] }),
    } as unknown as WorkspaceService;
    const access = {
      mode: "INVITE_ONLY" as const,
      status: "ACTIVE" as const,
      canUseProduct: true,
      canCreateWorkspace: true,
      reason: null,
    };
    const productAccess = {
      getUserContext: jest.fn().mockResolvedValue(access),
    } as unknown as ProductAccessService;
    const service = new BootstrapService(
      profiles,
      organizations,
      workspaces,
      productAccess,
    );

    await expect(service.getDashboardContext(userId)).resolves.toEqual({
      user,
      access,
      organizations: [organization],
      workspaces: [workspace],
    });
  });

  it("접근 승인 전에는 조직과 Workspace 데이터를 조회하지 않는다", async () => {
    const userId = randomUUID();
    const user = {
      id: userId,
      email: "pending@example.com",
      name: "Pending User",
      profileImageUrl: null,
    };
    const profiles = {
      getProfile: jest.fn().mockResolvedValue(user),
    } as unknown as ProfileService;
    const organizations = {
      listOrganizations: jest.fn(),
    } as unknown as OrganizationService;
    const workspaces = {
      listWorkspaces: jest.fn(),
    } as unknown as WorkspaceService;
    const access = {
      mode: "INVITE_ONLY" as const,
      status: "PENDING" as const,
      canUseProduct: false,
      canCreateWorkspace: false,
      reason: "PRODUCT_ACCESS_NOT_GRANTED",
    };
    const productAccess = {
      getUserContext: jest.fn().mockResolvedValue(access),
    } as unknown as ProductAccessService;
    const service = new BootstrapService(
      profiles,
      organizations,
      workspaces,
      productAccess,
    );

    await expect(service.getDashboardContext(userId)).resolves.toEqual({
      user,
      access,
      organizations: [],
      workspaces: [],
    });
    expect(organizations.listOrganizations).not.toHaveBeenCalled();
    expect(workspaces.listWorkspaces).not.toHaveBeenCalled();
  });
});
