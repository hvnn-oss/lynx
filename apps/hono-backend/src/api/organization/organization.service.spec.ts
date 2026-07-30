import { ERROR_CODES, USER_PERMISSIONS } from "@repo/constants";
import type { UserEntitlementEntity } from "@repo/database";
import { randomUUID } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import type { EntityManager } from "typeorm";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import type { ImageService } from "../../provider/image/image.service.js";
import type { OrganizationRepository } from "./organization.repository.js";
import { OrganizationService } from "./organization.service.js";

function createEntitlement(
  values: Partial<UserEntitlementEntity> = {},
): UserEntitlementEntity {
  return {
    maxOwnedOrganizations: 1,
    dailyOrganizationCreateLimit: 3,
    expiresAt: null,
    ...values,
  } as UserEntitlementEntity;
}

function createRepository(
  overrides: Partial<OrganizationRepository> = {},
): OrganizationRepository {
  const repository = {
    findByRequestId: jest.fn().mockResolvedValue(null),
    getLockedEntitlement: jest.fn().mockResolvedValue(createEntitlement()),
    countOwnedOrganizations: jest.fn().mockResolvedValue(0),
    countDailyCreations: jest.fn().mockResolvedValue(0),
    createRecords: jest.fn().mockResolvedValue({
      id: randomUUID(),
      name: "Lynx",
    }),
    transaction: jest.fn(async (work) => work({} as EntityManager)),
    ...overrides,
  };
  return repository as unknown as OrganizationRepository;
}

describe("OrganizationService", () => {
  const input = {
    userId: randomUUID(),
    name: "Lynx",
    requestId: randomUUID(),
    source: "DASHBOARD" as const,
  };

  it("현재 사용자가 참여 중인 조직 목록을 반환한다", async () => {
    const organizations = [
      {
        id: randomUUID(),
        name: "Lynx",
        profileImageKey: null,
        role: USER_PERMISSIONS.OWNER,
      },
    ];
    const repository = createRepository({
      listForUser: jest.fn().mockResolvedValue(organizations),
    });
    const service = new OrganizationService(repository);

    await expect(service.listOrganizations(input.userId)).resolves.toEqual({
      items: organizations.map(({ profileImageKey: _, ...organization }) => ({
        ...organization,
        profileImageUrl: null,
      })),
    });
    expect(repository.listForUser).toHaveBeenCalledWith(input.userId);
  });

  it("creates an organization when both limits allow it", async () => {
    const repository = createRepository();
    const service = new OrganizationService(repository);
    const planId = randomUUID();

    await expect(
      service.createOrganization({ ...input, planId }),
    ).resolves.toMatchObject({
      name: "Lynx",
      role: "OWNER",
    });
    expect(repository.createRecords).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ planId }),
    );
  });

  it("rejects creation when the active owned organization limit is reached", async () => {
    const repository = createRepository({
      countOwnedOrganizations: jest.fn().mockResolvedValue(1),
    } as Partial<OrganizationRepository>);
    const service = new OrganizationService(repository);

    await expect(service.createOrganization(input)).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.OWNED_ORGANIZATION_LIMIT_REACHED,
    } satisfies Partial<HTTPException>);
    expect(repository.createRecords).not.toHaveBeenCalled();
  });

  it("rejects creation when the daily creation limit is reached", async () => {
    const repository = createRepository({
      countDailyCreations: jest.fn().mockResolvedValue(3),
    } as Partial<OrganizationRepository>);
    const service = new OrganizationService(repository);

    await expect(service.createOrganization(input)).rejects.toMatchObject({
      status: 429,
      message: ERROR_CODES.DAILY_ORGANIZATION_CREATE_LIMIT_REACHED,
    } satisfies Partial<HTTPException>);
    expect(repository.createRecords).not.toHaveBeenCalled();
  });

  it("returns the existing organization for the same request id", async () => {
    const repository = createRepository({
      findByRequestId: jest.fn().mockResolvedValue({
        id: randomUUID(),
        name: "Existing",
      }),
    } as Partial<OrganizationRepository>);
    const service = new OrganizationService(repository);

    await expect(service.createOrganization(input)).resolves.toMatchObject({
      name: "Existing",
      role: "OWNER",
    });
    expect(repository.countOwnedOrganizations).not.toHaveBeenCalled();
    expect(repository.createRecords).not.toHaveBeenCalled();
  });

  it("조직 관리자에게 조직 프로필 이미지 변경을 허용한다", async () => {
    const organizationId = randomUUID();
    const repository = createRepository({
      findProfile: jest.fn().mockResolvedValue({
        organization: {
          id: organizationId,
          name: "Lynx",
          profileImageKey: null,
        },
        role: USER_PERMISSIONS.ADMIN,
      }),
      updateProfileImageKey: jest.fn(),
    } as Partial<OrganizationRepository>);
    const accessControl = {
      assertOrganizationCapability: jest.fn(),
    } as unknown as AccessControlService;
    const images = {
      upload: jest.fn().mockResolvedValue({
        storageKey: `profile-images/organizations/${organizationId}/profile`,
        url: "https://images.example.com/organization",
      }),
    } as unknown as ImageService;
    const service = new OrganizationService(
      repository,
      accessControl,
      () => images,
    );

    await expect(
      service.uploadProfileImage({
        userId: input.userId,
        organizationId,
        upload: {
          contentType: "image/png",
          bytes: new Uint8Array([1, 2]),
        },
      }),
    ).resolves.toEqual({
      profileImageUrl: "https://images.example.com/organization",
    });

    expect(images.upload).toHaveBeenCalledWith({
      ownerType: "organization",
      ownerId: organizationId,
      contentType: "image/png",
      bytes: new Uint8Array([1, 2]),
    });
    expect(repository.updateProfileImageKey).toHaveBeenCalledWith(
      organizationId,
      `profile-images/organizations/${organizationId}/profile`,
    );
  });

  it("Owner가 하위 멤버 역할을 관리자로 변경한다", async () => {
    const organizationId = randomUUID();
    const targetUserId = randomUUID();
    const target = {
      id: 7,
      role: USER_PERMISSIONS.MEMBER,
      joinedAt: new Date("2026-07-30T00:00:00.000Z"),
      user: {
        id: targetUserId,
        name: "Member",
        email: "member@example.com",
        profileImageKey: null,
      },
    };
    const repository = createRepository({
      findLockedMemberByUserId: jest.fn().mockResolvedValue({
        role: USER_PERMISSIONS.OWNER,
        user: { id: input.userId },
      }),
      findLockedMemberById: jest.fn().mockResolvedValue(target),
      saveMembership: jest.fn(),
      listMembers: jest.fn().mockImplementation(async () => [target]),
    } as Partial<OrganizationRepository>);
    const accessControl = {
      assertOrganizationCapability: jest.fn(),
    } as unknown as AccessControlService;
    const service = new OrganizationService(repository, accessControl);

    const result = await service.updateMemberRole({
      userId: input.userId,
      organizationId,
      memberId: target.id,
      update: { role: USER_PERMISSIONS.ADMIN },
    });

    expect(target.role).toBe(USER_PERMISSIONS.ADMIN);
    expect(repository.saveMembership).toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({
      userId: targetUserId,
      role: USER_PERMISSIONS.ADMIN,
    });
  });

  it("현재 Owner가 다른 멤버에게 소유권을 위임한다", async () => {
    const organizationId = randomUUID();
    const nextOwnerUserId = randomUUID();
    const organization = {
      id: organizationId,
      ownerUserId: input.userId,
    };
    const previousOwner = {
      role: USER_PERMISSIONS.OWNER,
      user: { id: input.userId },
    };
    const nextOwner = {
      role: USER_PERMISSIONS.MEMBER,
      user: { id: nextOwnerUserId },
    };
    const repository = createRepository({
      findLockedOrganization: jest.fn().mockResolvedValue(organization),
      findLockedMemberByUserId: jest
        .fn()
        .mockResolvedValueOnce(previousOwner)
        .mockResolvedValueOnce(nextOwner),
      saveOwnershipTransfer: jest.fn(),
    } as Partial<OrganizationRepository>);
    const accessControl = {
      assertOrganizationCapability: jest.fn(),
    } as unknown as AccessControlService;
    const service = new OrganizationService(repository, accessControl);

    await expect(
      service.transferOwner({
        userId: input.userId,
        organizationId,
        nextOwnerUserId,
      }),
    ).resolves.toEqual({
      previousOwnerUserId: input.userId,
      ownerUserId: nextOwnerUserId,
    });
    expect(previousOwner.role).toBe(USER_PERMISSIONS.ADMIN);
    expect(nextOwner.role).toBe(USER_PERMISSIONS.OWNER);
    expect(organization.ownerUserId).toBe(nextOwnerUserId);
  });

  it("조직 이름을 확인한 뒤 조직과 프로필 이미지를 삭제한다", async () => {
    const organizationId = randomUUID();
    const storageKey = `profile-images/organizations/${organizationId}/image.png`;
    const repository = createRepository({
      findProfile: jest.fn().mockResolvedValue({
        organization: {
          id: organizationId,
          name: "Lynx",
          profileImageKey: storageKey,
        },
        role: USER_PERMISSIONS.ADMIN,
      }),
      deleteOrganization: jest.fn().mockResolvedValue({
        deleted: true,
        profileImageKey: storageKey,
      }),
    } as Partial<OrganizationRepository>);
    const accessControl = {
      assertOrganizationCapability: jest.fn(),
    } as unknown as AccessControlService;
    const images = {
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as ImageService;
    const service = new OrganizationService(
      repository,
      accessControl,
      () => images,
    );

    await expect(
      service.deleteOrganization({
        userId: input.userId,
        organizationId,
        confirmationName: "Lynx",
      }),
    ).resolves.toEqual({ success: true });
    expect(images.delete).toHaveBeenCalledWith(
      "organization",
      organizationId,
      storageKey,
    );
  });
});
