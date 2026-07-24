import {
  USER_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
} from "@repo/constants";
import type { AccessControlRepository } from "./access-control.repository.js";
import { AccessControlService } from "./access-control.service.js";
import { CAPABILITIES } from "./capabilities.js";

describe("AccessControlService", () => {
  function createService() {
    const repository = {
      findOrganizationRole: jest.fn(),
      findWorkspaceAccess: jest.fn(),
    } as unknown as AccessControlRepository;
    return { repository, service: new AccessControlService(repository) };
  }

  it("allows an organization admin to create a workspace", async () => {
    const { repository, service } = createService();
    jest
      .mocked(repository.findOrganizationRole)
      .mockResolvedValue(USER_PERMISSIONS.ADMIN);

    await expect(
      service.assertOrganizationCapability({
        userId: "user-1",
        organizationId: "org-1",
        capability: CAPABILITIES.WORKSPACE_CREATE,
      }),
    ).resolves.toBeUndefined();
  });

  it("inherits workspace API key management from the organization admin role", async () => {
    const { repository, service } = createService();
    jest.mocked(repository.findWorkspaceAccess).mockResolvedValue({
      organizationId: "org-1",
      organizationRole: USER_PERMISSIONS.ADMIN,
      workspaceRole: null,
    });

    await expect(
      service.assertWorkspaceCapability({
        userId: "user-1",
        workspaceId: "workspace-1",
        capability: CAPABILITIES.WORKSPACE_API_KEY_CREATE,
      }),
    ).resolves.toMatchObject({ organizationRole: USER_PERMISSIONS.ADMIN });
  });

  it("allows a workspace admin to manage keys only in the assigned workspace", async () => {
    const { repository, service } = createService();
    jest.mocked(repository.findWorkspaceAccess).mockResolvedValue({
      organizationId: "org-1",
      organizationRole: USER_PERMISSIONS.MEMBER,
      workspaceRole: WORKSPACE_PERMISSIONS.ADMIN,
    });

    await expect(
      service.assertWorkspaceCapability({
        userId: "user-1",
        workspaceId: "workspace-1",
        capability: CAPABILITIES.WORKSPACE_API_KEY_REVOKE,
      }),
    ).resolves.toMatchObject({ workspaceRole: WORKSPACE_PERMISSIONS.ADMIN });
  });

  it("denies API key management to members", async () => {
    const { repository, service } = createService();
    jest.mocked(repository.findWorkspaceAccess).mockResolvedValue({
      organizationId: "org-1",
      organizationRole: USER_PERMISSIONS.MEMBER,
      workspaceRole: WORKSPACE_PERMISSIONS.MEMBER,
    });

    await expect(
      service.assertWorkspaceCapability({
        userId: "user-1",
        workspaceId: "workspace-1",
        capability: CAPABILITIES.WORKSPACE_API_KEY_LIST,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
