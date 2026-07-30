import {
  ACCESS_INVITATION_STATUS,
  ACCESS_INVITATION_TARGET_TYPE,
  ERROR_CODES,
  PRODUCT_ACCESS_MODE,
  USER_PERMISSIONS,
} from "@repo/constants";
import {
  AdminUserEntity,
  type AccessInvitationEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { env } from "../../common/config/config.js";
import { AccessInvitationService } from "./access-invitation.service.js";

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

describe("AccessInvitationService", () => {
  const originalSignupMode = env.SIGNUP_MODE;
  const originalBootstrapAdminEmail = env.PILOT_BOOTSTRAP_ADMIN_EMAIL;

  afterEach(() => {
    env.SIGNUP_MODE = originalSignupMode;
    env.PILOT_BOOTSTRAP_ADMIN_EMAIL = originalBootstrapAdminEmail;
    jest.restoreAllMocks();
  });

  function createService(options: { mailFails?: boolean } = {}) {
    const invitation = createInvitation();
    const repository = {
      create: jest.fn().mockResolvedValue(invitation),
      createOrganization: jest.fn(),
      deletePending: jest.fn().mockResolvedValue(undefined),
      findPending: jest.fn(),
      findPendingOrganization: jest.fn(),
      findOrganization: jest.fn(),
      findActiveOrganizationPlan: jest.fn().mockResolvedValue({
        id: invitation.organizationPlanId,
        code: "FREE",
        name: "Free",
        isActive: true,
      }),
      isOrganizationMemberEmail: jest.fn(),
      listOrganization: jest.fn(),
      revokeOrganization: jest.fn(),
      transaction: jest.fn(),
      findUser: jest.fn(),
      addOrganizationMember: jest.fn(),
      accept: jest.fn(),
      list: jest.fn(),
      revoke: jest.fn(),
    };
    const mailer = {
      sendMail: options.mailFails
        ? jest.fn().mockRejectedValue(new Error("SMTP unavailable"))
        : jest.fn().mockResolvedValue({ messageId: "mail-1" }),
    };
    const productAccess = {
      grantUser: jest.fn().mockResolvedValue(undefined),
    };
    const accessControl = {
      assertOrganizationCapability: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AccessInvitationService(
      repository as never,
      mailer as never,
      productAccess,
      accessControl as never,
    );
    return {
      accessControl,
      invitation,
      mailer,
      productAccess,
      repository,
      service,
    };
  }

  it("원본 토큰 대신 SHA-256 해시를 저장하고 이메일로 초대 링크를 보낸다", async () => {
    const { invitation, mailer, repository, service } = createService();

    await expect(
      service.create("admin-1", {
        email: " Pilot@Example.COM ",
        expiresInHours: 72,
        organizationPlanId: invitation.organizationPlanId!,
      }),
    ).resolves.toMatchObject({
      email: "pilot@example.com",
      status: ACCESS_INVITATION_STATUS.PENDING,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "pilot@example.com",
        tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        invitedByUserId: "admin-1",
        organizationPlanId: invitation.organizationPlanId,
      }),
    );
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "pilot@example.com",
        html: expect.stringContaining("/signup?invite="),
      }),
    );
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Free plan"),
      }),
    );
  });

  it("비활성 또는 존재하지 않는 요금제로는 초대를 만들지 않는다", async () => {
    const { invitation, mailer, repository, service } = createService();
    repository.findActiveOrganizationPlan.mockResolvedValue(null);

    await expect(
      service.create("admin-1", {
        email: "pilot@example.com",
        expiresInHours: 72,
        organizationPlanId: invitation.organizationPlanId!,
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.ADMIN_PLAN_NOT_FOUND,
    });
    expect(repository.create).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it("요금제를 보내지 않은 구버전 관리자 요청에는 활성 Free 요금제를 적용한다", async () => {
    const { invitation, repository, service } = createService();

    await service.create("admin-1", {
      email: "pilot@example.com",
      expiresInHours: 72,
    });

    expect(repository.findActiveOrganizationPlan).toHaveBeenCalledWith(
      undefined,
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationPlanId: invitation.organizationPlanId,
      }),
    );
  });

  it("초대 메일 전송 실패 시 사용되지 않은 레코드를 제거한다", async () => {
    const { invitation, repository, service } = createService({
      mailFails: true,
    });

    await expect(
      service.create("admin-1", {
        email: "pilot@example.com",
        expiresInHours: 24,
        organizationPlanId: invitation.organizationPlanId!,
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: ERROR_CODES.COULD_NOT_SEND_EMAIL,
    });
    expect(repository.deletePending).toHaveBeenCalledWith(invitation.id);
  });

  it("INVITE_ONLY 모드에서는 초대 토큰 없는 이메일 인증을 거부한다", async () => {
    env.SIGNUP_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    const { service } = createService();

    await expect(
      service.resolveSignupInvitation("pilot@example.com"),
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.SIGNUP_INVITATION_REQUIRED,
    });
  });

  it("설정된 첫 관리자 이메일은 초대 없이 가입을 시작할 수 있다", () => {
    env.SIGNUP_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    env.PILOT_BOOTSTRAP_ADMIN_EMAIL = "owner@example.com";
    const { service } = createService();

    expect(service.isBootstrapAdminEmail(" OWNER@Example.COM ")).toBe(true);
    expect(service.isBootstrapAdminEmail("other@example.com")).toBe(false);
  });

  it("첫 관리자에게 제품 권한과 SUPER_ADMIN 역할을 함께 부여한다", async () => {
    const { productAccess, service } = createService();
    const save = jest.fn().mockImplementation(async (value) => value);
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save,
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        expect(entity).toBe(AdminUserEntity);
        return repository;
      }),
    } as unknown as EntityManager;

    await service.activateBootstrapAdmin(manager, "user-1");

    expect(productAccess.grantUser).toHaveBeenCalledWith(
      manager,
      "user-1",
      null,
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "SUPER_ADMIN",
        isActive: true,
        user: { id: "user-1" },
      }),
    );
  });

  it("토큰 해시와 정규화 이메일이 일치하는 초대 ID를 반환한다", async () => {
    env.SIGNUP_MODE = PRODUCT_ACCESS_MODE.INVITE_ONLY;
    const { invitation, repository, service } = createService();
    repository.findPending.mockResolvedValue(invitation);

    await expect(
      service.resolveSignupInvitation(
        " Pilot@Example.COM ",
        "T".repeat(48),
      ),
    ).resolves.toBe(invitation.id);
    expect(repository.findPending).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "pilot@example.com",
    );
  });

  it("가입 트랜잭션에서 초대를 수락하고 사용자 grant를 활성화한다", async () => {
    const { invitation, productAccess, repository, service } = createService();
    const manager = {} as EntityManager;
    repository.accept.mockResolvedValue(invitation);

    await expect(
      service.acceptSignupInvitation(
        manager,
        invitation.id,
        invitation.email,
        "user-1",
      ),
    ).resolves.toEqual({
      organizationPlanId: invitation.organizationPlanId,
    });

    expect(repository.accept).toHaveBeenCalledWith(
      manager,
      invitation.id,
      invitation.email,
      "user-1",
    );
    expect(productAccess.grantUser).toHaveBeenCalledWith(
      manager,
      "user-1",
      invitation.invitedByUserId,
    );
  });

  it("기존 초대에 요금제가 없으면 기본 요금제 적용을 위해 null을 반환한다", async () => {
    const { invitation, repository, service } = createService();
    const manager = {} as EntityManager;
    repository.accept.mockResolvedValue(
      createInvitation({ organizationPlanId: null }),
    );

    await expect(
      service.acceptSignupInvitation(
        manager,
        invitation.id,
        invitation.email,
        "user-1",
      ),
    ).resolves.toEqual({ organizationPlanId: null });
  });

  it("다음 행을 이용해 초대 목록 cursor를 생성한다", async () => {
    const { repository, service } = createService();
    repository.list.mockResolvedValue([
      createInvitation(),
      createInvitation({
        id: "70302e18-767c-42d3-b5ba-ce0b68c821bc",
        createdAt: new Date("2026-07-28T00:00:00.000Z"),
      }),
    ]);

    await expect(service.list({ limit: 1 })).resolves.toEqual({
      items: [expect.objectContaining({ email: "pilot@example.com" })],
      nextCursor:
        "2026-07-29T00:00:00.000Z|0782d59b-d50a-4f2e-93c2-2bd7cf4ec94f",
    });
  });

  it("조직 관리자가 팀 초대를 만들면 UUID 링크를 메일로 보낸다", async () => {
    const { accessControl, mailer, repository, service } = createService();
    const organizationId = "4511e0fc-7ca8-478e-8ef4-cc66d557852f";
    const invitation = createInvitation({
      targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
      targetId: organizationId,
      role: USER_PERMISSIONS.MEMBER,
    });
    repository.findOrganization.mockResolvedValue({
      id: organizationId,
      name: "Acme",
    });
    repository.isOrganizationMemberEmail.mockResolvedValue(false);
    repository.createOrganization.mockResolvedValue(invitation);

    await service.createTeamInvitation("owner-1", organizationId, {
      email: " New@Example.com ",
      role: USER_PERMISSIONS.MEMBER,
      expiresInHours: 168,
    });

    expect(accessControl.assertOrganizationCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        userId: "owner-1",
      }),
    );
    expect(repository.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        organizationId,
        tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringMatching(/\/invite\?code=[0-9a-f-]{36}/),
      }),
    );
  });

  it("팀 초대 이메일과 가입 이메일이 다르면 가입을 거절한다", async () => {
    const { repository, service } = createService();
    repository.findPendingOrganization.mockResolvedValue(
      createInvitation({
        email: "invited@example.com",
        targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
        targetId: "4511e0fc-7ca8-478e-8ef4-cc66d557852f",
        role: USER_PERMISSIONS.VIEWER,
      }),
    );

    await expect(
      service.resolveTeamSignupInvitation(
        "other@example.com",
        "82d26b85-316a-42a8-94f7-30b63c74e52c",
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: ERROR_CODES.TEAM_INVITATION_EMAIL_MISMATCH,
    });
  });

  it("로그인 사용자가 팀 초대를 수락하면 멤버십과 제품 권한을 함께 부여한다", async () => {
    const { productAccess, repository, service } = createService();
    const organizationId = "4511e0fc-7ca8-478e-8ef4-cc66d557852f";
    const invitation = createInvitation({
      email: "member@example.com",
      targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
      targetId: organizationId,
      role: USER_PERMISSIONS.ADMIN,
    });
    const manager = {} as EntityManager;
    const user = {
      id: "0a123ca5-226f-47c7-ad1a-1263057ca8d2",
      email: "member@example.com",
    };
    repository.findPendingOrganization.mockResolvedValue(invitation);
    repository.findOrganization.mockResolvedValue({
      id: organizationId,
      name: "Acme",
    });
    repository.transaction.mockImplementation(async (work) => work(manager));
    repository.findUser.mockResolvedValue(user);
    repository.accept.mockResolvedValue(invitation);

    await expect(
      service.acceptTeamInvitation(
        user.id,
        "82d26b85-316a-42a8-94f7-30b63c74e52c",
      ),
    ).resolves.toEqual({
      organizationId,
      organizationName: "Acme",
      redirectTo: "/dashboard",
    });
    expect(repository.addOrganizationMember).toHaveBeenCalledWith(manager, {
      organizationId,
      user,
      role: USER_PERMISSIONS.ADMIN,
    });
    expect(productAccess.grantUser).toHaveBeenCalledWith(
      manager,
      user.id,
      invitation.invitedByUserId,
    );
  });
});
