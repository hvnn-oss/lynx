import { ERROR_CODES } from "@repo/constants";
import {
  OrganizationDomainEntity,
  UserAccountEntity,
  UserEntity,
  UserEntitlementEntity,
} from "@repo/database";
import { createHash, randomUUID } from "node:crypto";

import { AuthService } from "./auth.service.js";

type RefreshStoreMock = {
  getRefreshSession: jest.MockedFunction<
    (sessionId: string) => Promise<RefreshSession>
  >;
  rotateRefresh: jest.MockedFunction<
    (expectedSecretHash: string, replacement: RefreshSession) => Promise<void>
  >;
  revokeRefresh: jest.MockedFunction<
    (expectedSecretHash: string, sessionId: string) => Promise<void>
  >;
  saveRefresh: jest.MockedFunction<(session: RefreshSession) => Promise<void>>;
};

describe("AuthService", () => {
  let refreshStore: RefreshStoreMock;
  let service: AuthService;

  beforeEach(() => {
    refreshStore = {
      getRefreshSession: jest.fn(),
      rotateRefresh: jest.fn<
        Promise<void>,
        [expectedSecretHash: string, replacement: RefreshSession]
      >(async () => undefined),
      revokeRefresh: jest.fn<
        Promise<void>,
        [expectedSecretHash: string, sessionId: string]
      >(async () => undefined),
      saveRefresh: jest.fn<Promise<void>, [session: RefreshSession]>(
        async () => undefined,
      ),
    };
    service = new AuthService(refreshStore);
  });

  describe("generateRefreshToken", () => {
    it("원문 secret 대신 SHA-256 해시만 저장한다", async () => {
      const sessionId = randomUUID();
      const userId = randomUUID();

      const token = await service.generateRefreshToken(userId, sessionId);
      const [, secret] = token.split(".");
      const storedSession = refreshStore.saveRefresh.mock.calls[0]?.[0];

      expect(token).toMatch(new RegExp(`^${sessionId}\\.[A-Za-z0-9_-]{48}$`));
      expect(storedSession?.secretHash).toBe(
        createHash("sha256").update(secret).digest("hex"),
      );
      expect(storedSession).not.toHaveProperty("secret");
    });
  });

  describe("refresh", () => {
    it("토큰을 회전하면서 세션의 최초 생성 시각을 유지한다", async () => {
      const sessionId = randomUUID();
      const userId = randomUUID();
      const secret = "A".repeat(48);
      const secretHash = createHash("sha256").update(secret).digest("hex");
      const session: RefreshSession = {
        createdAt: 1_700_000_000,
        secretHash,
        sessionId,
        userId,
      };
      refreshStore.getRefreshSession.mockResolvedValue(session);
      jest
        .spyOn(service, "generateAccessToken")
        .mockResolvedValue("new-access-token");

      const result = await service.refresh(`${sessionId}.${secret}`);

      expect(result.access_token).toBe("new-access-token");
      expect(result.refresh_token).not.toBe(`${sessionId}.${secret}`);
      expect(refreshStore.rotateRefresh).toHaveBeenCalledWith(
        secretHash,
        expect.objectContaining({
          createdAt: session.createdAt,
          previousSecretHash: secretHash,
          rotatedAt: expect.any(Number),
          sessionId,
          userId,
        }),
      );
    });

    it("형식이 잘못된 토큰은 저장소 조회 전에 거부한다", async () => {
      await expect(service.refresh("invalid-token")).rejects.toMatchObject({
        message: ERROR_CODES.INVALID_REFRESH_TOKEN,
        status: 401,
      });
      expect(refreshStore.getRefreshSession).not.toHaveBeenCalled();
    });

    it("secret 검증과 회전을 저장소의 원자 연산에 위임한다", async () => {
      const sessionId = randomUUID();
      const session: RefreshSession = {
        createdAt: 1_700_000_000,
        secretHash: createHash("sha256").update("A".repeat(48)).digest("hex"),
        sessionId,
        userId: randomUUID(),
      };
      refreshStore.getRefreshSession.mockResolvedValue(session);
      refreshStore.rotateRefresh.mockRejectedValue(
        new Error(ERROR_CODES.INVALID_REFRESH_TOKEN),
      );

      await expect(
        service.refresh(`${sessionId}.${"B".repeat(48)}`),
      ).rejects.toThrow(ERROR_CODES.INVALID_REFRESH_TOKEN);
      expect(refreshStore.rotateRefresh).toHaveBeenCalledWith(
        createHash("sha256").update("B".repeat(48)).digest("hex"),
        expect.objectContaining({ previousSecretHash: session.secretHash }),
      );
    });
  });

  describe("logout", () => {
    it("현재 Refresh Token 해시로 세션 폐기를 요청한다", async () => {
      const sessionId = randomUUID();
      const secret = "C".repeat(48);

      await service.logout(`${sessionId}.${secret}`);

      expect(refreshStore.revokeRefresh).toHaveBeenCalledWith(
        createHash("sha256").update(secret).digest("hex"),
        sessionId,
      );
    });
  });
});

describe("AuthService 이메일 확인", () => {
  function createService(
    options: {
      shouldMailFail?: boolean;
      invitationId?: string;
      isBootstrapAdmin?: boolean;
    } = {},
  ) {
    const refreshStore = {
      getRefreshSession: jest.fn(),
      rotateRefresh: jest.fn(),
      revokeRefresh: jest.fn(),
      saveRefresh: jest.fn(),
    };
    const stageStore = {
      save: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      markEmailVerified: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const mailer = {
      sendMail: options.shouldMailFail
        ? jest.fn().mockRejectedValue(new Error("SMTP unavailable"))
        : jest.fn().mockResolvedValue({ messageId: "test-message" }),
    };
    const userRepository = { findOneBy: jest.fn().mockResolvedValue(null) };
    const domainRepository = { findOne: jest.fn().mockResolvedValue(null) };
    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === UserEntity) return userRepository;
        if (entity === OrganizationDomainEntity) return domainRepository;
        throw new Error("Unexpected repository");
      }),
      transaction: jest.fn(),
    };
    const accessInvitations = {
      resolveSignupInvitation: jest
        .fn()
        .mockResolvedValue(options.invitationId ?? null),
      resolveTeamSignupInvitation: jest.fn(),
      acceptSignupInvitation: jest.fn(),
      isBootstrapAdminEmail: jest
        .fn()
        .mockReturnValue(options.isBootstrapAdmin ?? false),
      activateBootstrapAdmin: jest.fn(),
    };

    const service = new AuthService(
      refreshStore as never,
      stageStore as never,
      { createOrganization: jest.fn() } as never,
      mailer as never,
      dataSource as never,
      accessInvitations as never,
    );
    return {
      accessInvitations,
      domainRepository,
      mailer,
      service,
      stageStore,
      userRepository,
    };
  }

  it("가입 단계를 저장하고 이메일 확인 링크를 발송한다", async () => {
    const { mailer, service, stageStore } = createService();

    await expect(
      service.createEmailVerification({ email: "USER@Example.COM" }),
    ).resolves.toEqual({ success: true });

    expect(stageStore.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        domain: "example.com",
        email: "user@example.com",
        email_verified: false,
      }),
    );
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "user@example.com",
        html: expect.stringContaining("/signup/verify?token="),
      }),
    );
  });

  it("검증된 초대 ID를 이메일 인증 단계에 함께 저장한다", async () => {
    const invitationId = randomUUID();
    const { accessInvitations, service, stageStore } = createService({
      invitationId,
    });

    await service.createEmailVerification({
      email: "pilot@example.com",
      invitation_token: "T".repeat(48),
    });

    expect(accessInvitations.resolveSignupInvitation).toHaveBeenCalledWith(
      "pilot@example.com",
      "T".repeat(48),
    );
    expect(stageStore.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ access_invitation_id: invitationId }),
    );
  });

  it("첫 관리자 이메일은 초대 없이 bootstrap 가입 단계로 저장한다", async () => {
    const { accessInvitations, service, stageStore } = createService({
      isBootstrapAdmin: true,
    });

    await service.createEmailVerification({
      email: "owner@example.com",
    });

    expect(stageStore.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        bootstrap_admin: true,
        access_invitation_id: undefined,
      }),
    );
    expect(
      accessInvitations.resolveSignupInvitation,
    ).not.toHaveBeenCalled();
  });

  it("팀 초대는 조직과 역할을 가입 단계에 저장하고 파일럿 초대 검사를 대신한다", async () => {
    const { accessInvitations, service, stageStore } = createService();
    const invitationId = randomUUID();
    const organizationId = randomUUID();
    const code = randomUUID();
    accessInvitations.resolveTeamSignupInvitation.mockResolvedValue({
      invitationId,
      organizationId,
      role: "VIEWER",
    });

    await service.createEmailVerification({
      email: "member@example.com",
      team_invitation_code: code,
      redirects: `/invite?code=${code}`,
    });

    expect(
      accessInvitations.resolveTeamSignupInvitation,
    ).toHaveBeenCalledWith("member@example.com", code);
    expect(accessInvitations.resolveSignupInvitation).not.toHaveBeenCalled();
    expect(stageStore.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        access_invitation_id: invitationId,
        invited_organization: organizationId,
        invited_organization_role: "VIEWER",
        redirect_path: `/invite?code=${code}`,
      }),
    );
  });

  it("이메일 확인 응답으로 조직 생성 단계 필요 여부와 이동 경로를 돌려준다", async () => {
    const { service, stageStore } = createService();
    const token = randomUUID();
    stageStore.get.mockResolvedValue({
      email: "member@example.com",
      domain: "example.com",
      email_verified: false,
      invited_organization: randomUUID(),
      invited_organization_role: "MEMBER",
      redirect_path: "/dashboard",
    });

    await expect(service.verifyEmail(token)).resolves.toEqual({
      success: true,
      email: "member@example.com",
      redirects: "/dashboard",
      requiresOrganization: false,
    });
    expect(stageStore.markEmailVerified).toHaveBeenCalledWith(
      token,
      expect.objectContaining({ email: "member@example.com" }),
    );
  });

  it("SMTP 발송이 실패하면 가입 단계를 제거하고 공개 오류를 반환한다", async () => {
    const { service, stageStore } = createService({ shouldMailFail: true });

    await expect(
      service.createEmailVerification({ email: "user@example.com" }),
    ).rejects.toMatchObject({
      message: ERROR_CODES.COULD_NOT_SEND_EMAIL,
      status: 500,
    });
    expect(stageStore.remove).toHaveBeenCalledWith(expect.any(String));
  });

  it("강제 SSO 도메인에는 확인 메일을 발송하지 않는다", async () => {
    const { domainRepository, mailer, service, stageStore } = createService();
    domainRepository.findOne.mockResolvedValue({
      organization: { forceSSO: true },
    });

    await expect(
      service.createEmailVerification({ email: "user@example.com" }),
    ).rejects.toMatchObject({
      message: ERROR_CODES.ORG_MUST_USE_SSO,
      status: 403,
    });
    expect(stageStore.save).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });
});

describe("AuthService 초대 가입", () => {
  it("초대를 수락하고 선택된 요금제로 첫 조직을 생성한다", async () => {
    const invitationId = randomUUID();
    const organizationPlanId = randomUUID();
    const userId = randomUUID();
    const stageStore = {
      get: jest.fn().mockResolvedValue({
        email: "pilot@example.com",
        domain: "example.com",
        email_verified: true,
        access_invitation_id: invitationId,
      }),
      save: jest.fn(),
      markEmailVerified: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const userRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({
        id: userId,
        email: "pilot@example.com",
        name: "Pilot",
      }),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const accountRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const entitlementRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const manager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity) => {
        if (entity === UserEntity) return userRepository;
        if (entity === UserAccountEntity) return accountRepository;
        if (entity === UserEntitlementEntity) return entitlementRepository;
        throw new Error("Unexpected repository");
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const accessInvitations = {
      resolveSignupInvitation: jest.fn(),
      acceptSignupInvitation: jest.fn().mockResolvedValue({
        organizationPlanId,
      }),
      isBootstrapAdminEmail: jest.fn().mockReturnValue(false),
      activateBootstrapAdmin: jest.fn().mockResolvedValue(undefined),
    };
    const organizationService = {
      createOrganization: jest.fn().mockResolvedValue({
        id: randomUUID(),
        name: "Pilot Organization",
        role: "OWNER",
      }),
    };
    const service = new AuthService(
      {
        getRefreshSession: jest.fn(),
        rotateRefresh: jest.fn(),
        revokeRefresh: jest.fn(),
        saveRefresh: jest.fn(),
      } as never,
      stageStore as never,
      organizationService as never,
      { sendMail: jest.fn() } as never,
      dataSource as never,
      accessInvitations as never,
    );

    await expect(
      service.register({
        token: randomUUID(),
        name: "Pilot",
        password: "password123",
        organization_info: { name: "Pilot Organization" },
      }),
    ).resolves.toEqual({ success: true });

    expect(accessInvitations.acceptSignupInvitation).toHaveBeenCalledWith(
      manager,
      invitationId,
      "pilot@example.com",
      userId,
    );
    expect(organizationService.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        name: "Pilot Organization",
        planId: organizationPlanId,
      }),
      manager,
    );
  });
});
