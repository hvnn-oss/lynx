import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateEmailVerificationDto,
  CreateEmailVerificationResponseDto,
  VerifyEmailTokenDto,
  VerifyEmailTokenResponseDto,
  SignUpDto,
  SignUpResponseDto,
  LoginDto,
} from '@repo/dto';
import {
  OrganizationDomainEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  UserAccountEntity,
  UserEntity,
  OidcAccountEntity,
} from '@repo/database';
import * as express from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../providers/redis/redis.constants';
import { MailerService } from '../../providers/smtp/mail.service';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import {
  AccessTokenPayload,
  BCRYPT_SALT_ROUNDS,
  ERROR_CODES,
  LOGIN_PROVIDERS,
  RefreshTokenPayload,
} from '@repo/constants';
import ms, { StringValue } from 'ms';

interface OidcDiscoveryConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

interface OidcTokenResponse {
  access_token?: string;
  refresh_token?: string;
}

interface OidcUserProfile {
  sub: string;
  email?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // =====================================================
  // 회원가입
  // =====================================================

  /**
   * 이메일 인증 URL을 생성합니다.
   * @param requestEmailVerifyDto 인증 URL 생성에 필요한 정보를 입력받습니다.
   * @returns 결과를 리턴합니다.
   */
  // 이메일 인증 메일을 발송합니다. (인증용 임시 토큰을 생성하여 가입 링크 이메일 발송)
  async createEmailVerify(
    requestVerifyCodeDto: CreateEmailVerificationDto,
  ): Promise<CreateEmailVerificationResponseDto> {
    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );

    const emailParts = requestVerifyCodeDto.email.split('@');
    if (emailParts.length !== 2) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_EMAIL,
        message: 'Invalid email.',
      });
    }
    const emailDomain = emailParts[1];

    // 사용자 존재 여부를 가장 먼저 확인하여 불필요한 도메인 쿼리를 방지합니다.
    const userRepository = this.dataSource.getRepository(UserEntity);
    const existsUser = await userRepository.findOneBy({
      email: requestVerifyCodeDto.email,
    });
    if (existsUser) {
      throw new ConflictException({
        error_code: ERROR_CODES.USER_ALREADY_EXISTS,
        message: 'User already exists.',
      });
    }

    // 조직 전용 이메일 및 SSO 강제 여부 확인
    const foundDomain = await domainRepository.findOne({
      where: { domain: emailDomain },
      relations: { organization: true },
    });
    if (foundDomain && foundDomain.organization?.forceSSO) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.ORG_MUST_USE_SSO,
        message: `This organization is currently using sso options. Please sign in with sso.`,
      });
    }

    // Redis에 가입 임시 정보 저장 (테스트 환경에선 만료 제한 시간 제거)
    const token = crypto.randomUUID();
    const verifyCodeOptions = {
      email: requestVerifyCodeDto.email,
      domain: emailDomain,
      email_verified: false,
      invited_organization: requestVerifyCodeDto.invited_organization_id,
    };
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      await this.redis.set(
        `signup:stage:${token}`,
        JSON.stringify(verifyCodeOptions),
      );
    } else {
      await this.redis.set(
        `signup:stage:${token}`,
        JSON.stringify(verifyCodeOptions),
        'EX',
        60 * 30,
      );
    }

    // 가입 인증 링크 메일 전송
    try {
      await this.mailService.sendMail(
        requestVerifyCodeDto.email,
        'Verify Your Email',
        `Verify URL : ${this.configService.get('FRONTEND_URL')}/signup/verify?token=${token}`,
      );
    } catch {
      throw new InternalServerErrorException({
        error_code: ERROR_CODES.COULD_NOT_SEND_EMAIL,
        message: 'Failed to send email',
      });
    }

    return {
      success: true,
    };
  }

  // 가입 링크의 토큰을 검증하고 인증 상태를 완료로 변경합니다. (토큰 만료 시간은 10분으로 변경)
  async verifyEmail(
    verifyEmailDto: VerifyEmailTokenDto,
  ): Promise<VerifyEmailTokenResponseDto> {
    // Redis에서 가입 정보 조회
    const rawData = await this.redis.get(
      `signup:stage:${verifyEmailDto.token}`,
    );
    if (!rawData) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_SIGNUP_TOKEN,
        message: 'Unexpected token.',
      });
    }
    const signUpInfo = JSON.parse(rawData) as {
      email: string;
      domain: string;
      email_verified: boolean;
      invited_organization?: string;
    };

    // 이메일 인증 완료 처리 및 Redis 정보 갱신 (테스트 환경에선 만료 제한 시간 제거)
    signUpInfo.email_verified = true;
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      await this.redis.set(
        `signup:stage:${verifyEmailDto.token}`,
        JSON.stringify(signUpInfo),
      );
    } else {
      await this.redis.set(
        `signup:stage:${verifyEmailDto.token}`,
        JSON.stringify(signUpInfo),
        'EX',
        60 * 10,
      );
    }

    return {
      success: true,
      email: signUpInfo.email,
    };
  }

  // 이메일 인증 확인 후 사용자 계정과 조직을 데이터베이스에 생성합니다. (비밀번호는 해싱 후 저장)
  async register(registerDto: SignUpDto): Promise<SignUpResponseDto> {
    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );

    // Redis에서 가입 임시 정보 조회
    const rawData = await this.redis.get(`signup:stage:${registerDto.token}`);
    if (!rawData) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_SIGNUP_TOKEN,
        message: 'Unexpected token.',
      });
    }
    const signUpInfo = JSON.parse(rawData) as {
      email: string;
      domain: string;
      email_verified: boolean;
      invited_organization?: string;
    };
    if (!signUpInfo.invited_organization && !registerDto.organization_info)
      throw new ConflictException({
        error_code: ERROR_CODES.INVALID_ORG,
        message: 'Invalid organization informations',
      });

    // 이메일 인증 완료 상태 여부 확인
    if (!signUpInfo.email_verified)
      throw new ForbiddenException({
        error_code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'Not verified email. check your email and try again.',
      });

    // SSO 강제 여부 체크
    const foundDomain = await domainRepository.findOne({
      where: {
        domain: signUpInfo.domain,
      },
      relations: {
        organization: true,
      },
    });
    if (foundDomain && foundDomain?.organization?.forceSSO) {
      throw new ConflictException({
        error_code: ERROR_CODES.ORG_MUST_USE_SSO,
        message:
          'This organization is currently using sso options. Please sign in with sso.',
      });
    }

    // CPU 부하가 큰 Bcrypt 해싱은 DB 커넥션을 점유하지 않도록 트랜잭션 밖에서 수행합니다.
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    // 사용자 정보 및 소속 조직 저장 트랜잭션
    await this.dataSource.transaction(async (entityManager) => {
      const userRepository = entityManager.getRepository(UserEntity);
      const userAccountRepository =
        entityManager.getRepository(UserAccountEntity);
      const orgRepository = entityManager.getRepository(OrganizationEntity);
      const orgUserRepository = entityManager.getRepository(
        OrganizationUserEntity,
      );

      let organization: OrganizationEntity;
      if (signUpInfo.invited_organization) {
        const foundOrg = await orgRepository.findOneBy({
          id: signUpInfo.invited_organization,
        });
        if (!foundOrg)
          throw new ConflictException({
            error_code: ERROR_CODES.ORG_NOT_FOUND,
            message: "Couldn't find organization",
          });
        organization = foundOrg;
      } else {
        organization = orgRepository.create({
          name: registerDto.organization_info?.name,
        });
        await orgRepository.save(organization);
      }
      const currentDate = new Date();
      const user = userRepository.create({
        email: signUpInfo.email,
        name: registerDto.name,
        createdAt: currentDate,
      });
      await userRepository.save(user);

      const userAccount = userAccountRepository.create({
        provider: LOGIN_PROVIDERS.LOCAL,
        passwordHash: hashedPassword,
        user,
      });
      await userAccountRepository.save(userAccount);

      const orgUser = orgUserRepository.create({
        joinedAt: currentDate,
        role: 'OWNER',
        organization,
        user,
      });
      await orgUserRepository.save(orgUser);
    });

    // 가입 완료 후 Redis의 임시 데이터 삭제
    await this.redis.del(`signup:stage:${registerDto.token}`);
    return {
      success: true,
    };
  }

  // 이메일 및 비밀번호를 검증하여 로그인 토큰 세션을 생성합니다. (SSO 여부와 비밀번호 일치 검증)
  async login(loginDto: LoginDto) {
    const email = loginDto.email;
    const password = loginDto.password;

    const userRepository = this.dataSource.getRepository(UserEntity);
    const user = await userRepository.findOne({
      where: { email },
      relations: { accounts: true },
    });

    // 1. 유저 존재 여부를 먼저 검증하여 불필요한 추가 로직 실행을 차단합니다. (Fail Fast)
    if (!user) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    // 2. SSO 강제 여부를 확인하여 로컬 로그인을 차단합니다. (CPU 비용 높은 Bcrypt 이전에 실행하여 리소스 낭비 방지)
    const emailParts = email.split('@');
    if (emailParts.length === 2) {
      const emailDomain = emailParts[1];
      const domainRepository = this.dataSource.getRepository(
        OrganizationDomainEntity,
      );
      const foundDomain = await domainRepository.findOne({
        where: { domain: emailDomain },
        relations: { organization: true },
      });
      if (foundDomain && foundDomain.organization?.forceSSO) {
        throw new ForbiddenException({
          error_code: ERROR_CODES.ORG_MUST_USE_SSO,
          message:
            'This organization is currently using sso options. Please sign in with sso.',
        });
      }
    }

    // 3. 로컬 가입 계정이 있는지 확인합니다.
    const localAccount = user.accounts.find(
      (account) => account.provider === LOGIN_PROVIDERS.LOCAL,
    );
    if (!localAccount || !localAccount.passwordHash) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    // 4. 비밀번호를 검증합니다.
    const isPasswordValid = await bcrypt.compare(
      password,
      localAccount.passwordHash,
    );
    if (!isPasswordValid) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    // 토큰 쌍 발급
    const accessToken = await this.generateAccessToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
    };
  }

  // 만료된 Access Token 재발급을 위해 Redis 내 Refresh Token 식별 정보를 확인한 후 갱신합니다.
  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
        },
      );

      const userId = payload.sub;
      const jti = payload.jti;

      // Redis에 저장해둔 최신 jti와 일치하는지 대조
      const storedJti = await this.redis.get(`refresh:${userId}`);
      if (!storedJti || storedJti !== jti) {
        throw new ForbiddenException({
          error_code: ERROR_CODES.TOKEN_EXPIRED,
          message: 'Refresh token has expired or is invalid.',
        });
      }

      // 신규 토큰 쌍으로 로테이션 갱신
      const newAccessToken = await this.generateAccessToken(userId);
      const newRefreshToken = await this.generateRefreshToken(userId);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException({
        error_code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Refresh token has expired or is invalid.',
      });
    }
  }

  // 사용자 세션 만료를 위해 Redis에 저장된 Refresh Token 식별키를 폐기합니다.
  async logout(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
        },
      );
      const userId = payload.sub;
      await this.redis.del(`refresh:${userId}`);
    } catch {
      // 오류 무시 및 정상 성공 응답
    }
    return { success: true };
  }

  // =====================================================
  // 토큰 관리
  // =====================================================
  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: `Missing required server configuration: ${key}`,
      });
    }
    return value;
  }

  async generateAccessToken(userId: string) {
    const exp_time = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN');
    if (!exp_time) throw new InternalServerErrorException();
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expInSeconds =
      nowInSeconds + Math.floor(ms(exp_time as StringValue) / 1000);
    const payload: AccessTokenPayload = {
      sub: userId,
      iat: nowInSeconds,
      exp: expInSeconds,
    };
    const newToken = await this.jwtService.signAsync(payload, {
      secret: this.getRequiredConfig('JWT_ACCESS_SECRET'),
    });
    return newToken;
  }

  async generateRefreshToken(userId: string) {
    const exp_time = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
    if (!exp_time) throw new InternalServerErrorException();
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expInSeconds =
      nowInSeconds + Math.floor(ms(exp_time as StringValue) / 1000);
    const jti = crypto.randomUUID();
    const payload: RefreshTokenPayload = {
      sub: userId,
      jti,
      exp: expInSeconds,
    };
    const newToken = await this.jwtService.signAsync(payload, {
      secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
    });
    const expireSeconds = Math.floor(ms(exp_time as StringValue) / 1000);
    await this.redis.set(`refresh:${userId}`, jti, 'EX', expireSeconds);
    return newToken;
  }

  // 이메일 도메인을 판별하여 해당 조직의 OIDC 또는 SAML IdP 로그인 페이지로 리다이렉트합니다.
  async handleSsoLogin(email: string, res: express.Response) {
    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      throw new BadRequestException('Invalid email address.');
    }
    const domain = emailParts[1];

    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );
    const foundDomain = await domainRepository.findOne({
      where: { domain },
      relations: { organization: true },
    });

    if (
      !foundDomain ||
      !foundDomain.organization ||
      !foundDomain.organization.useSso
    ) {
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/login?error=sso-not-configured`,
      );
    }

    const org = foundDomain.organization;

    // 1. OIDC 로그인 흐름 구성
    if (org.oidcIssuer && org.oidcClientId) {
      try {
        const discoveryUrl = `${org.oidcIssuer}/.well-known/openid-configuration`;
        const fetchRes = await fetch(discoveryUrl);
        const config = (await fetchRes.json()) as OidcDiscoveryConfig;
        const authEndpoint = config.authorization_endpoint;

        const redirectUri = `${this.configService.get('BACKEND_URL')}/auth/sso/oidc/callback`;
        const state = crypto.randomUUID();

        await this.redis.set(
          `oidc:state:${state}`,
          JSON.stringify({ email, orgId: org.id }),
          'EX',
          600,
        );

        const authUrl =
          `${authEndpoint}?` +
          `response_type=code` +
          `&client_id=${org.oidcClientId}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent('openid email profile')}` +
          `&state=${state}`;

        return res.redirect(authUrl);
      } catch (err) {
        this.logger.error('Failed to initiate OIDC redirect', err);
        return res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login?error=sso-initiation-failed`,
        );
      }
    }

    // 2. SAML 2.0 로그인 흐름 구성 (AuthnRequest XML 생성 후 리다이렉트)
    if (org.samlEntryPoint && org.samlIssuer) {
      this.logger.warn(
        'SAML login is disabled until signed assertion validation is implemented.',
      );
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/login?error=saml-validation-required`,
      );
    }

    return res.redirect(
      `${this.configService.get('FRONTEND_URL')}/login?error=sso-not-configured`,
    );
  }

  // OIDC 인증 콜백을 받아 인가 코드를 토큰으로 교환하고 유저 세션을 생성합니다.
  async handleOidcCallback(code: string, state: string, res: express.Response) {
    try {
      const stateDataRaw = await this.redis.get(`oidc:state:${state}`);
      if (!stateDataRaw) {
        return res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login?error=sso-invalid-state`,
        );
      }
      await this.redis.del(`oidc:state:${state}`);
      const { orgId } = JSON.parse(stateDataRaw) as {
        orgId: string;
      };

      const orgRepository = this.dataSource.getRepository(OrganizationEntity);
      const org = await orgRepository.findOne({ where: { id: orgId } });
      if (
        !org ||
        !org.oidcIssuer ||
        !org.oidcClientId ||
        !org.oidcClientSecret
      ) {
        return res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login?error=sso-configuration-error`,
        );
      }

      const discoveryUrl = `${org.oidcIssuer}/.well-known/openid-configuration`;
      const discRes = await fetch(discoveryUrl);
      const discConfig = (await discRes.json()) as OidcDiscoveryConfig;
      const tokenEndpoint = discConfig.token_endpoint;
      const userInfoEndpoint = discConfig.userinfo_endpoint;

      const redirectUri = `${this.configService.get('BACKEND_URL')}/auth/sso/oidc/callback`;
      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: org.oidcClientId,
          client_secret: org.oidcClientSecret,
        }),
      });

      const tokenData = (await tokenResponse.json()) as OidcTokenResponse;
      if (!tokenData.access_token) {
        return res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login?error=sso-token-exchange-failed`,
        );
      }

      const userProfileRes = await fetch(userInfoEndpoint, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userProfile = (await userProfileRes.json()) as OidcUserProfile;
      const oidcEmail = userProfile.email || userProfile.sub;
      if (!oidcEmail) {
        return res.redirect(
          `${this.configService.get('FRONTEND_URL')}/login?error=sso-profile-fetch-failed`,
        );
      }

      const { refreshToken } = await this.signSsoUser(
        oidcEmail,
        LOGIN_PROVIDERS.OIDC,
        org,
        {
          issuer: org.oidcIssuer,
          subject: userProfile.sub,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        },
      );

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/dashboard?sso=success`,
      );
    } catch (err) {
      this.logger.error('Failed to handle OIDC callback', err);
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/login?error=sso-callback-failed`,
      );
    }
  }

  // SAML 2.0 응답(Assertion)을 파싱하여 로그인 세션을 생성합니다. (SAML POST 백 콜백 처리)
  handleSamlCallback(samlResponse: string, res: express.Response) {
    try {
      void samlResponse;
      this.logger.warn(
        'Rejected SAML callback because signed assertion validation is not implemented.',
      );
      return res.send(`
        <script>
          window.location.href = '${this.configService.get('FRONTEND_URL')}/login?error=saml-validation-required';
        </script>
      `);
    } catch (err) {
      this.logger.error('Failed to handle SAML callback', err);
      return res.send(`
        <script>
          window.location.href = '${this.configService.get('FRONTEND_URL')}/login?error=sso-callback-failed';
        </script>
      `);
    }
  }

  // SSO 인증 성공 유저 정보를 토대로 로컬 계정 조회/생성 처리를 진행하고 토큰 쌍을 발행합니다.
  private async signSsoUser(
    email: string,
    provider: 'OIDC' | 'SAML',
    organization: OrganizationEntity,
    oidcInfo?: {
      issuer: string;
      subject: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
    const userRepository = this.dataSource.getRepository(UserEntity);
    const userAccountRepository =
      this.dataSource.getRepository(UserAccountEntity);
    const orgUserRepository = this.dataSource.getRepository(
      OrganizationUserEntity,
    );

    let user = await userRepository.findOne({
      where: { email },
      relations: { accounts: true },
    });

    const currentDate = new Date();

    if (!user) {
      user = userRepository.create({
        email,
        name: email.split('@')[0],
        createdAt: currentDate,
      });
      await userRepository.save(user);

      const userAccount = userAccountRepository.create({
        provider:
          provider === 'OIDC' ? LOGIN_PROVIDERS.OIDC : LOGIN_PROVIDERS.SAML,
        providerAccountId: provider === 'SAML' ? email : oidcInfo?.subject,
        user,
      });
      await userAccountRepository.save(userAccount);

      const orgUser = orgUserRepository.create({
        joinedAt: currentDate,
        role: 'MEMBER',
        organization,
        user,
      });
      await orgUserRepository.save(orgUser);

      if (provider === 'OIDC' && oidcInfo) {
        const oidcAccountRepository =
          this.dataSource.getRepository(OidcAccountEntity);
        const oidcAccount = oidcAccountRepository.create({
          issuer: oidcInfo.issuer,
          subject: oidcInfo.subject,
          accessToken: oidcInfo.accessToken,
          refreshToken: oidcInfo.refreshToken,
          userAccount,
        });
        await oidcAccountRepository.save(oidcAccount);
      }
    } else {
      const existingLink = await orgUserRepository.findOne({
        where: { user: { id: user.id }, organization: { id: organization.id } },
      });
      if (!existingLink) {
        const orgUser = orgUserRepository.create({
          joinedAt: currentDate,
          role: 'MEMBER',
          organization,
          user,
        });
        await orgUserRepository.save(orgUser);
      }

      let providerAccount = user.accounts.find(
        (acc) =>
          acc.provider ===
          (provider === 'OIDC' ? LOGIN_PROVIDERS.OIDC : LOGIN_PROVIDERS.SAML),
      );
      if (!providerAccount) {
        providerAccount = userAccountRepository.create({
          provider:
            provider === 'OIDC' ? LOGIN_PROVIDERS.OIDC : LOGIN_PROVIDERS.SAML,
          providerAccountId: provider === 'SAML' ? email : oidcInfo?.subject,
          user,
        });
        await userAccountRepository.save(providerAccount);

        if (provider === 'OIDC' && oidcInfo) {
          const oidcAccountRepository =
            this.dataSource.getRepository(OidcAccountEntity);
          const oidcAccount = oidcAccountRepository.create({
            issuer: oidcInfo.issuer,
            subject: oidcInfo.subject,
            accessToken: oidcInfo.accessToken,
            refreshToken: oidcInfo.refreshToken,
            userAccount: providerAccount,
          });
          await oidcAccountRepository.save(oidcAccount);
        }
      }
    }

    const accessToken = await this.generateAccessToken(user.id);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
    };
  }
}
