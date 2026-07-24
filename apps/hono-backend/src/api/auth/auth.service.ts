import {
  ERROR_CODES,
  LOGIN_PROVIDERS,
  ORGANIZATION_CREATION_SOURCES,
  USER_PERMISSIONS,
} from "@repo/constants";
import {
  OrganizationDomainEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  UserAccountEntity,
  UserEntitlementEntity,
  UserEntity,
} from "@repo/database";
import type { CreateEmailVerificationDto, SignUpDto } from "@repo/dto";
import { getConnInfo } from "@hono/node-server/conninfo";
import bcrypt from "bcrypt";
import { createHash, randomUUID } from "node:crypto";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import type { EntityManager } from "typeorm";
import { env } from "../../common/config/config.js";
import { UnauthorizedErrorException } from "../../common/exceptions/unauthorized.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { smtpTransporter } from "../../provider/smtp/smtp-config.js";
import { getJwtNumericDate } from "../../common/util/jwt-time.js";
import { generateRandomString } from "../../common/util/random-string.js";
import {
  hashRefreshTokenSecret,
  parseRefreshToken,
} from "../../common/util/refresh-token.js";
import {
  refreshTokenStore,
  type RefreshTokenStore,
} from "./refresh-token.store.js";
import {
  signupStageStore,
  type SignupStage,
  type SignupStageStore,
} from "./signup-stage.store.js";
import {
  orgService,
  type OrganizationService,
} from "../organization/organization.service.js";

const BCRYPT_SALT_ROUNDS = 12;

/** 로그인 세션과 Access/Refresh Token 생명주기를 관리합니다. */
export class AuthService {
  constructor(
    private readonly refreshStore: Pick<
      RefreshTokenStore,
      "getRefreshSession" | "revokeRefresh" | "rotateRefresh" | "saveRefresh"
    > = refreshTokenStore,
    private readonly stageStore: SignupStageStore = signupStageStore,
    private readonly organizationService: OrganizationService = orgService,
    private readonly mailer: SignupMailer = smtpTransporter,
    private readonly dataSource: AuthDataSource = AppDataSource,
  ) {}

  /**
   * 가입 단계를 만들고 사용자에게 이메일 확인 링크를 전송합니다.
   * @param input 확인할 이메일과 선택 초대 조직 정보입니다.
   * @returns 이메일 발송 요청의 성공 여부입니다.
   */
  async createEmailVerification(
    input: CreateEmailVerificationDto,
  ): Promise<{ success: true }> {
    const email = input.email.trim().toLowerCase();
    const domain = this.getEmailDomain(email);

    await this.assertUserDoesNotExist(email);
    await this.assertDomainAllowsLocalAuth(domain);

    const token = randomUUID();
    const stage: SignupStage = {
      email,
      domain,
      email_verified: false,
      invited_organization: input.invited_organization_id,
    };
    await this.stageStore.save(token, stage);

    try {
      await this.mailer.sendMail({
        from: env.SMTP_FROM_EMAIL,
        to: email,
        subject: "Verify your Lynx email",
        html: this.createVerificationEmailHtml(token),
      });
    } catch {
      // 전송되지 않은 링크의 가입 단계가 Redis에 남지 않게 정리합니다.
      await this.stageStore.remove(token).catch(() => undefined);
      throw new HTTPException(500, {
        message: ERROR_CODES.COULD_NOT_SEND_EMAIL,
      });
    }

    return { success: true };
  }

  /**
   * 이메일 확인 단계를 완료 처리하고 회원가입 입력에 사용할 시간을 연장합니다.
   * @param token 이메일 확인 링크에 포함된 가입 토큰입니다.
   * @returns 확인된 이메일과 성공 여부입니다.
   */
  async verifyEmail(token: string): Promise<{ success: true; email: string }> {
    const stage = await this.getSignupStageOrThrow(token);
    await this.stageStore.markEmailVerified(token, stage);
    return { success: true, email: stage.email };
  }

  /**
   * 사용자와 로그인 계정을 먼저 만든 뒤 초대 가입 또는 최초 조직 생성을 처리합니다.
   * @param input 계약 검증을 통과한 회원가입 입력입니다.
   * @returns 회원가입 성공 여부입니다.
   */
  async register(input: SignUpDto): Promise<{ success: true }> {
    const stage = await this.getSignupStageOrThrow(input.token);
    if (!stage.email_verified) {
      throw new HTTPException(409, { message: ERROR_CODES.EMAIL_NOT_VERIFIED });
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    await this.dataSource.transaction(async (manager: EntityManager) => {
      await this.assertEmailAvailable(manager, stage.email);
      const user = await this.createUserAndAccount(
        manager,
        stage.email,
        input.name,
        passwordHash,
      );

      if (stage.invited_organization) {
        await this.joinInvitedOrganization(
          manager,
          user,
          stage.invited_organization,
        );
        return;
      }

      if (input.organization_info) {
        await this.organizationService.createOrganization(
          {
            userId: user.id,
            name: input.organization_info.name,
            requestId: input.token,
            source: ORGANIZATION_CREATION_SOURCES.SIGNUP,
          },
          manager,
        );
      }
    });

    // 계정 생성은 커밋됐으므로 임시 단계 정리 실패가 성공 응답을 뒤집지 않습니다.
    await this.stageStore.remove(input.token).catch(() => undefined);
    return { success: true };
  }

  /**
   * 검증된 신원과 요청 메타데이터로 로그인 완료 입력을 구성합니다.
   * @param c 현재 Hono 요청 컨텍스트입니다.
   * @param identity 검증된 사용자 신원입니다.
   * @param options 워크스페이스와 연결에 관한 선택 입력입니다.
   * @returns 토큰 발급에 사용할 로그인 완료 입력입니다.
   */
  buildCompleteLoginInput(
    c: Context,
    identity: AuthenticatedIdentity,
    options: Pick<
      CompleteLoginInput,
      "expectedWorkspaceId" | "connectionId"
    > = {},
  ): CompleteLoginInput {
    const ipAddress = getConnInfo(c).remote.address;
    const userAgent = c.req.header("User-Agent");

    return {
      identity,
      ipAddress,
      userAgent,
      ...options,
    };
  }

  /**
   * 짧은 수명의 API Access Token을 발급합니다.
   * @param payload 사용자와 세션 식별자입니다.
   * @returns 서명된 JWT입니다.
   */
  async generateAccessToken(payload: AccessTokenPayload): Promise<string> {
    const now = getJwtNumericDate();

    return sign(
      {
        sub: payload.userId,
        sid: payload.sessionId,
        typ: "access",
        iss: "lynxops.co",
        aud: "lynx-api",
        iat: now,
        exp: now + env.ACCESS_TOKEN_TTL_SECONDS,
      },
      env.JWT_SECRET,
      "HS256",
    );
  }

  /**
   * 세션과 연결된 일회성 secret 기반 Refresh Token을 발급합니다.
   * @param userId 사용자 식별자입니다.
   * @param sessionId 로그인 세션 식별자입니다.
   * @param ipAddress 로그인 요청의 원격 주소입니다.
   * @param userAgent 로그인 요청의 User-Agent입니다.
   * @returns 클라이언트에 전달할 Refresh Token입니다.
   */
  async generateRefreshToken(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const generated = this.createRefreshToken(
      userId,
      sessionId,
      ipAddress,
      userAgent,
    );
    await this.refreshStore.saveRefresh(generated.session);

    return generated.token;
  }

  /**
   * 검증된 로그인 요청에 대한 세션을 만들고 토큰을 발급합니다.
   * @param input 검증된 신원과 요청 메타데이터입니다.
   * @returns Access Token과 Refresh Token입니다.
   */
  async complete(input: CompleteLoginInput): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const sessionId = randomUUID();
    const accessTokenPayload: AccessTokenPayload = {
      sessionId,
      userId: input.identity.userId,
    };
    const access_token = await this.generateAccessToken(accessTokenPayload);
    const refresh_token = await this.generateRefreshToken(
      input.identity.userId,
      sessionId,
      input.ipAddress,
      input.userAgent,
    );

    return { access_token, refresh_token };
  }

  /**
   * Refresh Token을 검증하고 Access Token과 회전된 Refresh Token을 발급합니다.
   *
   * 세션의 TTL은 회전 시점부터 다시 계산되므로 sliding session이 유지됩니다.
   * @param refreshToken 쿠키로 전달된 Refresh Token입니다.
   * @returns 새 Access Token과 일회성 Refresh Token입니다.
   */
  async refresh(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) this.throwInvalidRefreshToken();

    const session = await this.refreshStore.getRefreshSession(parsed.sessionId);
    const presentedSecretHash = hashRefreshTokenSecret(parsed.secret);

    const payload: AccessTokenPayload = {
      sessionId: session.sessionId,
      userId: session.userId,
    };
    const access_token = await this.generateAccessToken(payload);
    const rotated = this.createRefreshToken(
      session.userId,
      session.sessionId,
      session.ipAddress,
      session.userAgent,
      session.createdAt,
      session.secretHash,
    );

    // 비교와 교체를 원자적으로 실행해 같은 토큰의 동시 재사용을 막습니다.
    await this.refreshStore.rotateRefresh(presentedSecretHash, rotated.session);

    return { access_token, refresh_token: rotated.token };
  }

  /** Refresh Token이 가리키는 로그인 세션을 폐기합니다. */
  async logout(refreshToken: string): Promise<void> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) this.throwInvalidRefreshToken();

    await this.refreshStore.revokeRefresh(
      hashRefreshTokenSecret(parsed.secret),
      parsed.sessionId,
    );
  }

  /** 가입 토큰의 임시 상태를 조회하고 없으면 공개 오류로 변환합니다. */
  private async getSignupStageOrThrow(token: string): Promise<SignupStage> {
    const stage = await this.stageStore.get(token);
    if (!stage) {
      throw new HTTPException(400, {
        message: ERROR_CODES.INVALID_SIGNUP_TOKEN,
      });
    }
    return stage;
  }

  /** 이메일에 이미 연결된 사용자가 있는지 확인합니다. */
  private async assertUserDoesNotExist(email: string): Promise<void> {
    const existingUser = await this.dataSource
      .getRepository(UserEntity)
      .findOneBy({ email });
    if (existingUser) {
      throw new HTTPException(409, {
        message: ERROR_CODES.USER_ALREADY_EXISTS,
      });
    }
  }

  /** 회사 도메인이 로컬 로그인을 금지하고 강제 SSO를 사용하는지 확인합니다. */
  private async assertDomainAllowsLocalAuth(domain: string): Promise<void> {
    const organizationDomain = await this.dataSource
      .getRepository(OrganizationDomainEntity)
      .findOne({
        where: { domain },
        relations: { organization: true },
      });
    if (organizationDomain?.organization.forceSSO) {
      throw new HTTPException(403, {
        message: ERROR_CODES.ORG_MUST_USE_SSO,
      });
    }
  }

  /** 동일 이메일의 동시 가입을 직렬화한 뒤 기존 사용자 여부를 확인합니다. */
  private async assertEmailAvailable(
    manager: EntityManager,
    email: string,
  ): Promise<void> {
    // 같은 이메일의 동시 가입 요청이 unique 제약까지 경합하지 않도록 합니다.
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
    const existingUser = await manager.getRepository(UserEntity).findOneBy({
      email,
    });
    if (existingUser) {
      throw new HTTPException(409, {
        message: ERROR_CODES.USER_ALREADY_EXISTS,
      });
    }
  }

  /** 사용자, 로컬 로그인 계정, 기본 FREE 권한을 같은 트랜잭션에 저장합니다. */
  private async createUserAndAccount(
    manager: EntityManager,
    email: string,
    name: string,
    passwordHash: string,
  ): Promise<UserEntity> {
    const user = manager.getRepository(UserEntity).create({ email, name });
    await manager.getRepository(UserEntity).save(user);

    const account = manager.getRepository(UserAccountEntity).create({
      provider: LOGIN_PROVIDERS.LOCAL,
      passwordHash,
      user,
    });
    await manager.getRepository(UserAccountEntity).save(account);
    await manager
      .getRepository(UserEntitlementEntity)
      .save(UserEntitlementEntity.createFree(user));
    return user;
  }

  /** 초대 대상 조직을 확인하고 사용자를 일반 멤버로 연결합니다. */
  private async joinInvitedOrganization(
    manager: EntityManager,
    user: UserEntity,
    organizationId: string,
  ): Promise<void> {
    const organization = await manager
      .getRepository(OrganizationEntity)
      .findOneBy({ id: organizationId });
    if (!organization) {
      throw new HTTPException(404, { message: ERROR_CODES.ORG_NOT_FOUND });
    }

    const membership = manager.getRepository(OrganizationUserEntity).create({
      organization,
      user,
      role: USER_PERMISSIONS.MEMBER,
      joinedAt: new Date(),
    });
    await manager.getRepository(OrganizationUserEntity).save(membership);
  }

  /** 정규화된 이메일에서 회사 도메인을 추출합니다. */
  private getEmailDomain(email: string): string {
    return email.slice(email.lastIndexOf("@") + 1);
  }

  /** 가입 확인 링크를 포함한 최소 HTML 메일 본문을 생성합니다. */
  private createVerificationEmailHtml(token: string): string {
    const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
    const verificationUrl = `${frontendUrl}/signup/verify?token=${encodeURIComponent(token)}`;
    return [
      "<p>Lynx 가입을 완료하려면 아래 링크에서 이메일을 확인해 주세요.</p>",
      `<p><a href="${verificationUrl}">이메일 확인하기</a></p>`,
      "<p>이 링크는 30분 동안 유효합니다.</p>",
    ].join("");
  }

  /** 원문 secret과 Redis에 저장할 해시를 포함한 Refresh Token을 생성합니다. */
  private createRefreshToken(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
    createdAt = getJwtNumericDate(),
    previousSecretHash?: string,
  ): { token: string; session: RefreshSession } {
    const secret = generateRandomString(48);
    const secretHash = createHash("sha256").update(secret).digest("hex");
    const session: RefreshSession = {
      userId,
      secretHash,
      previousSecretHash,
      sessionId,
      createdAt,
      ipAddress,
      userAgent,
    };

    return { token: `${sessionId}.${secret}`, session };
  }

  /** Refresh Token 검증 실패를 외부 계약과 동일한 오류로 변환합니다. */
  private throwInvalidRefreshToken(): never {
    throw new UnauthorizedErrorException(ERROR_CODES.INVALID_REFRESH_TOKEN);
  }
}

/** 애플리케이션에서 공유하는 인증 서비스입니다. */
export const authService = new AuthService();
