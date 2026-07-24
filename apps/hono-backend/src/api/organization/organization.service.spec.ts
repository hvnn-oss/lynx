import { ERROR_CODES } from "@repo/constants";
import type { UserEntitlementEntity } from "@repo/database";
import { randomUUID } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import type { EntityManager } from "typeorm";
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
});
