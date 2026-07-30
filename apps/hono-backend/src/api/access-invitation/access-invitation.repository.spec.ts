import { ACCESS_INVITATION_STATUS } from "@repo/constants";
import { AccessInvitationEntity } from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { AccessInvitationRepository } from "./access-invitation.repository.js";

function createInvitation(
  overrides: Partial<AccessInvitationEntity> = {},
): AccessInvitationEntity {
  return {
    id: "0782d59b-d50a-4f2e-93c2-2bd7cf4ec94f",
    email: "pilot@example.com",
    tokenHash: "a".repeat(64),
    targetType: "PRODUCT",
    targetId: null,
    role: null,
    organizationPlanId: "a4c424cf-0e63-479b-a60d-18445d5fc1d1",
    status: ACCESS_INVITATION_STATUS.PENDING,
    invitedByUserId: "a77c2374-5d68-4a79-96e5-881a0eb76978",
    acceptedByUserId: null,
    expiresAt: new Date("2026-08-01T00:00:00.000Z"),
    acceptedAt: null,
    createdAt: new Date("2026-07-29T00:00:00.000Z"),
    updatedAt: new Date("2026-07-29T00:00:00.000Z"),
    ...overrides,
  } as AccessInvitationEntity;
}

describe("AccessInvitationRepository", () => {
  afterEach(() => jest.restoreAllMocks());

  it("이메일 잠금 안에서 기존 대기 초대를 취소하고 새 초대를 저장한다", async () => {
    const invitation = createInvitation();
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    const repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn().mockReturnValue(invitation),
      save: jest.fn().mockResolvedValue(invitation),
    };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as EntityManager;
    jest
      .spyOn(AppDataSource, "transaction")
      .mockImplementation(async (callback) => callback(manager));

    await new AccessInvitationRepository().create({
      email: invitation.email,
      tokenHash: invitation.tokenHash,
      invitedByUserId: invitation.invitedByUserId,
      organizationPlanId: invitation.organizationPlanId!,
      expiresAt: invitation.expiresAt,
    });

    expect(manager.query).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [invitation.email],
    );
    expect(queryBuilder.set).toHaveBeenCalledWith({
      status: ACCESS_INVITATION_STATUS.REVOKED,
    });
    expect(repository.save).toHaveBeenCalledWith(invitation);
  });

  it("만료된 대기 초대는 EXPIRED로 변경하고 반환하지 않는다", async () => {
    const invitation = createInvitation({
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    jest.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOneBy: jest.fn().mockResolvedValue(invitation),
      update,
    } as never);

    await expect(
      new AccessInvitationRepository().findPending(
        invitation.tokenHash,
        invitation.email,
      ),
    ).resolves.toBeNull();
    expect(update).toHaveBeenCalledWith(
      {
        id: invitation.id,
        status: ACCESS_INVITATION_STATUS.PENDING,
      },
      { status: ACCESS_INVITATION_STATUS.EXPIRED },
    );
  });

  it("가입 트랜잭션에서 초대를 잠그고 ACCEPTED로 변경한다", async () => {
    const invitation = createInvitation({
      expiresAt: new Date(Date.now() + 60_000),
    });
    const repository = {
      findOne: jest.fn().mockResolvedValue(invitation),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as EntityManager;

    await expect(
      new AccessInvitationRepository().accept(
        manager,
        invitation.id,
        invitation.email,
        "user-1",
      ),
    ).resolves.toMatchObject({
      status: ACCESS_INVITATION_STATUS.ACCEPTED,
      acceptedByUserId: "user-1",
      acceptedAt: expect.any(Date),
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: invitation.id },
      lock: { mode: "pessimistic_write" },
    });
  });
});
