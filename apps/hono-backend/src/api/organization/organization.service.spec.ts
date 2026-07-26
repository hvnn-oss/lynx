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

  it("creates an organization when both limits allow it", async () => {
    const repository = createRepository();
    const service = new OrganizationService(repository);

    await expect(service.createOrganization(input)).resolves.toMatchObject({
      name: "Lynx",
      role: "OWNER",
    });
    expect(repository.createRecords).toHaveBeenCalledTimes(1);
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
});
