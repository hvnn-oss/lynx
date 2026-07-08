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
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  CreateEmailVerificationDto,
  CreateEmailVerificationResponseDto,
  LoginDto,
  SignUpDto,
  SignUpResponseDto,
  VerifyEmailTokenDto,
  VerifyEmailTokenResponseDto,
} from '@repo/dto';
import {
  OidcAccountEntity,
  OrganizationDomainEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  UserAccountEntity,
  UserEntity,
} from '@repo/database';
import {
  AccessTokenPayload,
  BCRYPT_SALT_ROUNDS,
  ERROR_CODES,
  LOGIN_PROVIDERS,
  RefreshTokenPayload,
} from '@repo/constants';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as express from 'express';
import Redis from 'ioredis';
import ms, { StringValue } from 'ms';
import { DataSource, EntityManager } from 'typeorm';
import { REDIS_CLIENT } from '../../providers/redis/redis.constants';
import { MailerService } from '../../providers/smtp/mail.service';
import {
  OIDC_STATE_PREFIX,
  OIDC_STATE_TTL_SECONDS,
  REFRESH_TOKEN_PREFIX,
  SIGNUP_EMAIL_TTL_SECONDS,
  SIGNUP_STAGE_PREFIX,
  VERIFIED_SIGNUP_TTL_SECONDS,
} from '../../common/constants/auth.constants';
import {
  AuthTokenPair,
  OidcCallbackOrganization,
  OidcDiscoveryConfig,
  OidcLoginOrganization,
  OidcTokenResponse,
  OidcUserProfile,
  SignupStage,
  SsoProvider,
} from '../../common/types/auth.types';

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

  async createEmailVerify(
    requestVerifyDto: CreateEmailVerificationDto,
  ): Promise<CreateEmailVerificationResponseDto> {
    const { email, domain } = this.parseEmail(requestVerifyDto.email);

    await this.ensureUserDoesNotExist(email);
    await this.ensureDomainAllowsLocalAuth(domain, ForbiddenException);

    const token = randomUUID();
    await this.saveSignupStage(
      token,
      {
        email,
        domain,
        email_verified: false,
        invited_organization: requestVerifyDto.invited_organization_id,
      },
      SIGNUP_EMAIL_TTL_SECONDS,
    );
    await this.sendSignupVerificationEmail(email, token);

    return { success: true };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailTokenDto,
  ): Promise<VerifyEmailTokenResponseDto> {
    const signupStage = await this.getSignupStageOrThrow(verifyEmailDto.token);

    await this.saveSignupStage(
      verifyEmailDto.token,
      {
        ...signupStage,
        email_verified: true,
      },
      VERIFIED_SIGNUP_TTL_SECONDS,
    );

    return {
      success: true,
      email: signupStage.email,
    };
  }

  async register(registerDto: SignUpDto): Promise<SignUpResponseDto> {
    const signupStage = await this.getSignupStageOrThrow(registerDto.token);

    this.ensureSignupHasOrganization(signupStage, registerDto);
    this.ensureSignupEmailIsVerified(signupStage);
    await this.ensureDomainAllowsLocalAuth(
      signupStage.domain,
      ConflictException,
    );

    const passwordHash = await this.hashPassword(registerDto.password);
    await this.createLocalUser(registerDto, signupStage, passwordHash);
    await this.redis.del(this.getSignupStageKey(registerDto.token));

    return { success: true };
  }

  async login(loginDto: LoginDto): Promise<AuthTokenPair> {
    const user = await this.findUserForLogin(loginDto.email);
    if (!user) {
      throw this.invalidCredentials();
    }

    const { domain } = this.parseEmail(loginDto.email);
    await this.ensureDomainAllowsLocalAuth(domain, ForbiddenException);

    const localAccount = user.accounts.find(
      (account) => account.provider === LOGIN_PROVIDERS.LOCAL,
    );
    if (!localAccount?.passwordHash) {
      throw this.invalidCredentials();
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      localAccount.passwordHash,
    );
    if (!isPasswordValid) {
      throw this.invalidCredentials();
    }

    return this.generateTokenPair(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
        },
      );

      const storedJti = await this.redis.get(
        this.getRefreshTokenKey(payload.sub),
      );
      if (!storedJti || storedJti !== payload.jti) {
        throw this.expiredToken();
      }

      return this.generateTokenPair(payload.sub);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw this.expiredToken();
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
        },
      );
      await this.redis.del(this.getRefreshTokenKey(payload.sub));
    } catch {
      // Logout stays idempotent even when the refresh token is already invalid.
    }

    return { success: true };
  }

  async handleSsoLogin(email: string, res: express.Response) {
    const { domain } = this.parseEmail(email);
    const organization = await this.findSsoOrganization(domain);

    if (!organization) {
      return this.redirectToLogin(res, 'sso-not-configured');
    }

    if (this.hasOidcLoginConfig(organization)) {
      return this.redirectToOidcProvider(email, organization, res);
    }

    if (organization.samlEntryPoint && organization.samlIssuer) {
      this.logger.warn(
        'SAML login is disabled until signed assertion validation is implemented.',
      );
      return this.redirectToLogin(res, 'saml-validation-required');
    }

    return this.redirectToLogin(res, 'sso-not-configured');
  }

  async handleOidcCallback(code: string, state: string, res: express.Response) {
    try {
      const stateData = await this.consumeOidcState(state);
      if (!stateData) {
        return this.redirectToLogin(res, 'sso-invalid-state');
      }

      const organization = await this.findOidcCallbackOrganization(
        stateData.orgId,
      );
      if (!organization) {
        return this.redirectToLogin(res, 'sso-configuration-error');
      }

      const discovery = await this.fetchOidcDiscovery(organization.oidcIssuer);
      if (!discovery.token_endpoint || !discovery.userinfo_endpoint) {
        return this.redirectToLogin(res, 'sso-configuration-error');
      }

      const tokenData = await this.exchangeOidcCode(
        code,
        organization,
        discovery.token_endpoint,
      );
      if (!tokenData.access_token) {
        return this.redirectToLogin(res, 'sso-token-exchange-failed');
      }

      const userProfile = await this.fetchOidcUserProfile(
        discovery.userinfo_endpoint,
        tokenData.access_token,
      );
      const oidcEmail = userProfile.email || userProfile.sub;
      if (!oidcEmail) {
        return this.redirectToLogin(res, 'sso-profile-fetch-failed');
      }

      const { refreshToken } = await this.signSsoUser(
        oidcEmail,
        LOGIN_PROVIDERS.OIDC,
        organization,
        {
          issuer: organization.oidcIssuer,
          subject: userProfile.sub,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        },
      );

      this.setRefreshTokenCookie(res, refreshToken);
      return res.redirect(`${this.getFrontendUrl()}/dashboard?sso=success`);
    } catch (error) {
      this.logger.error('Failed to handle OIDC callback', error);
      return this.redirectToLogin(res, 'sso-callback-failed');
    }
  }

  handleSamlCallback(samlResponse: string, res: express.Response) {
    try {
      void samlResponse;
      this.logger.warn(
        'Rejected SAML callback because signed assertion validation is not implemented.',
      );
      return this.sendSamlRedirectScript(res, 'saml-validation-required');
    } catch (error) {
      this.logger.error('Failed to handle SAML callback', error);
      return this.sendSamlRedirectScript(res, 'sso-callback-failed');
    }
  }

  async generateAccessToken(userId: string) {
    const expiresIn = this.getRequiredConfig('JWT_ACCESS_EXPIRES_IN');
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expInSeconds =
      nowInSeconds + Math.floor(ms(expiresIn as StringValue) / 1000);

    const payload: AccessTokenPayload = {
      sub: userId,
      iat: nowInSeconds,
      exp: expInSeconds,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getRequiredConfig('JWT_ACCESS_SECRET'),
    });
  }

  async generateRefreshToken(userId: string) {
    const expiresIn = this.getRequiredConfig('JWT_REFRESH_EXPIRES_IN');
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expInSeconds =
      nowInSeconds + Math.floor(ms(expiresIn as StringValue) / 1000);
    const jti = randomUUID();

    const payload: RefreshTokenPayload = {
      sub: userId,
      jti,
      exp: expInSeconds,
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getRequiredConfig('JWT_REFRESH_SECRET'),
    });

    await this.redis.set(
      this.getRefreshTokenKey(userId),
      jti,
      'EX',
      Math.floor(ms(expiresIn as StringValue) / 1000),
    );

    return refreshToken;
  }

  private async createLocalUser(
    registerDto: SignUpDto,
    signupStage: SignupStage,
    passwordHash: string,
  ) {
    await this.dataSource.transaction(async (entityManager) => {
      const organization = await this.resolveSignupOrganization(
        entityManager,
        registerDto,
        signupStage,
      );
      const currentDate = new Date();

      const userRepository = entityManager.getRepository(UserEntity);
      const user = userRepository.create({
        email: signupStage.email,
        name: registerDto.name,
        createdAt: currentDate,
      });
      await userRepository.save(user);

      const userAccountRepository =
        entityManager.getRepository(UserAccountEntity);
      const userAccount = userAccountRepository.create({
        provider: LOGIN_PROVIDERS.LOCAL,
        passwordHash,
        user,
      });
      await userAccountRepository.save(userAccount);

      await this.linkUserToOrganization(
        entityManager,
        user,
        organization,
        'OWNER',
        currentDate,
      );
    });
  }

  private async resolveSignupOrganization(
    entityManager: EntityManager,
    registerDto: SignUpDto,
    signupStage: SignupStage,
  ) {
    const orgRepository = entityManager.getRepository(OrganizationEntity);

    if (signupStage.invited_organization) {
      const organization = await orgRepository.findOneBy({
        id: signupStage.invited_organization,
      });
      if (!organization) {
        throw new ConflictException({
          error_code: ERROR_CODES.ORG_NOT_FOUND,
          message: "Couldn't find organization",
        });
      }
      return organization;
    }

    const organization = orgRepository.create({
      name: registerDto.organization_info?.name,
    });
    return orgRepository.save(organization);
  }

  private async signSsoUser(
    email: string,
    provider: SsoProvider,
    organization: OrganizationEntity,
    oidcInfo?: {
      issuer: string;
      subject: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ): Promise<AuthTokenPair> {
    const userRepository = this.dataSource.getRepository(UserEntity);
    const userAccountRepository =
      this.dataSource.getRepository(UserAccountEntity);

    let user = await userRepository.findOne({
      where: { email },
      relations: { accounts: true },
    });

    const currentDate = new Date();
    if (!user) {
      user = await this.createSsoUser(
        email,
        provider,
        organization,
        currentDate,
        oidcInfo,
      );
    } else {
      await this.ensureUserOrganizationLink(user, organization, currentDate);
      await this.ensureSsoAccount(
        user,
        provider,
        userAccountRepository,
        oidcInfo,
      );
    }

    return this.generateTokenPair(user.id);
  }

  private async createSsoUser(
    email: string,
    provider: SsoProvider,
    organization: OrganizationEntity,
    currentDate: Date,
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

    const user = userRepository.create({
      email,
      name: email.split('@')[0],
      createdAt: currentDate,
    });
    await userRepository.save(user);

    const userAccount = userAccountRepository.create({
      provider: this.toLoginProvider(provider),
      providerAccountId: provider === 'SAML' ? email : oidcInfo?.subject,
      user,
    });
    await userAccountRepository.save(userAccount);

    await this.linkUserToOrganization(
      this.dataSource.manager,
      user,
      organization,
      'MEMBER',
      currentDate,
    );

    if (provider === 'OIDC' && oidcInfo) {
      await this.createOidcAccount(userAccount, oidcInfo);
    }

    return user;
  }

  private async ensureSsoAccount(
    user: UserEntity,
    provider: SsoProvider,
    userAccountRepository: ReturnType<DataSource['getRepository']>,
    oidcInfo?: {
      issuer: string;
      subject: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
    const loginProvider = this.toLoginProvider(provider);
    const existingAccount = user.accounts.find(
      (account) => account.provider === loginProvider,
    );
    if (existingAccount) return;

    const providerAccount = userAccountRepository.create({
      provider: loginProvider,
      providerAccountId: provider === 'SAML' ? user.email : oidcInfo?.subject,
      user,
    }) as UserAccountEntity;
    await userAccountRepository.save(providerAccount);

    if (provider === 'OIDC' && oidcInfo) {
      await this.createOidcAccount(providerAccount, oidcInfo);
    }
  }

  private async createOidcAccount(
    userAccount: UserAccountEntity,
    oidcInfo: {
      issuer: string;
      subject: string;
      accessToken?: string;
      refreshToken?: string;
    },
  ) {
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

  private async ensureUserOrganizationLink(
    user: UserEntity,
    organization: OrganizationEntity,
    currentDate: Date,
  ) {
    const orgUserRepository = this.dataSource.getRepository(
      OrganizationUserEntity,
    );
    const existingLink = await orgUserRepository.findOne({
      where: { user: { id: user.id }, organization: { id: organization.id } },
    });
    if (existingLink) return;

    const orgUser = orgUserRepository.create({
      joinedAt: currentDate,
      role: 'MEMBER',
      organization,
      user,
    });
    await orgUserRepository.save(orgUser);
  }

  private async linkUserToOrganization(
    entityManager: EntityManager,
    user: UserEntity,
    organization: OrganizationEntity,
    role: 'OWNER' | 'MEMBER',
    joinedAt: Date,
  ) {
    const orgUserRepository = entityManager.getRepository(
      OrganizationUserEntity,
    );
    const orgUser = orgUserRepository.create({
      joinedAt,
      role,
      organization,
      user,
    });
    await orgUserRepository.save(orgUser);
  }

  private async redirectToOidcProvider(
    email: string,
    organization: OidcLoginOrganization,
    res: express.Response,
  ) {
    try {
      const discovery = await this.fetchOidcDiscovery(organization.oidcIssuer);
      if (!discovery.authorization_endpoint) {
        return this.redirectToLogin(res, 'sso-configuration-error');
      }

      const state = randomUUID();
      await this.redis.set(
        this.getOidcStateKey(state),
        JSON.stringify({ email, orgId: organization.id }),
        'EX',
        OIDC_STATE_TTL_SECONDS,
      );

      const authUrl =
        `${discovery.authorization_endpoint}?` +
        `response_type=code` +
        `&client_id=${organization.oidcClientId}` +
        `&redirect_uri=${encodeURIComponent(this.getOidcRedirectUri())}` +
        `&scope=${encodeURIComponent('openid email profile')}` +
        `&state=${state}`;

      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error('Failed to initiate OIDC redirect', error);
      return this.redirectToLogin(res, 'sso-initiation-failed');
    }
  }

  private async fetchOidcDiscovery(issuer: string) {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    return (await response.json()) as OidcDiscoveryConfig;
  }

  private async exchangeOidcCode(
    code: string,
    organization: OidcCallbackOrganization,
    tokenEndpoint: string,
  ) {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.getOidcRedirectUri(),
        client_id: organization.oidcClientId,
        client_secret: organization.oidcClientSecret,
      }),
    });

    return (await response.json()) as OidcTokenResponse;
  }

  private async fetchOidcUserProfile(
    userInfoEndpoint: string,
    accessToken: string,
  ) {
    const response = await fetch(userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return (await response.json()) as OidcUserProfile;
  }

  private async consumeOidcState(state: string) {
    const rawState = await this.redis.get(this.getOidcStateKey(state));
    if (!rawState) return null;

    await this.redis.del(this.getOidcStateKey(state));
    return JSON.parse(rawState) as { email: string; orgId: string };
  }

  private async findSsoOrganization(domain: string) {
    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );
    const organizationDomain = await domainRepository.findOne({
      where: { domain },
      relations: { organization: true },
    });

    const organization = organizationDomain?.organization;
    return organization?.useSso ? organization : null;
  }

  private async findOidcCallbackOrganization(orgId: string) {
    const orgRepository = this.dataSource.getRepository(OrganizationEntity);
    const organization = await orgRepository.findOne({ where: { id: orgId } });

    if (!organization || !this.hasOidcCallbackConfig(organization)) {
      return null;
    }

    return organization;
  }

  private hasOidcLoginConfig(
    organization: OrganizationEntity,
  ): organization is OidcLoginOrganization {
    return Boolean(organization.oidcIssuer && organization.oidcClientId);
  }

  private hasOidcCallbackConfig(
    organization: OrganizationEntity,
  ): organization is OidcCallbackOrganization {
    return Boolean(
      organization.oidcIssuer &&
      organization.oidcClientId &&
      organization.oidcClientSecret,
    );
  }

  private async ensureDomainAllowsLocalAuth(
    domain: string,
    ExceptionType: typeof ForbiddenException | typeof ConflictException,
  ) {
    const domainRepository = this.dataSource.getRepository(
      OrganizationDomainEntity,
    );
    const organizationDomain = await domainRepository.findOne({
      where: { domain },
      relations: { organization: true },
    });

    if (organizationDomain?.organization?.forceSSO) {
      throw new ExceptionType({
        error_code: ERROR_CODES.ORG_MUST_USE_SSO,
        message:
          'This organization is currently using sso options. Please sign in with sso.',
      });
    }
  }

  private async ensureUserDoesNotExist(email: string) {
    const userRepository = this.dataSource.getRepository(UserEntity);
    const existingUser = await userRepository.findOneBy({ email });
    if (existingUser) {
      throw new ConflictException({
        error_code: ERROR_CODES.USER_ALREADY_EXISTS,
        message: 'User already exists.',
      });
    }
  }

  private async findUserForLogin(email: string) {
    const userRepository = this.dataSource.getRepository(UserEntity);
    return userRepository.findOne({
      where: { email },
      relations: { accounts: true },
    });
  }

  private ensureSignupHasOrganization(
    signupStage: SignupStage,
    registerDto: SignUpDto,
  ) {
    if (signupStage.invited_organization || registerDto.organization_info) {
      return;
    }

    throw new ConflictException({
      error_code: ERROR_CODES.INVALID_ORG,
      message: 'Invalid organization informations',
    });
  }

  private ensureSignupEmailIsVerified(signupStage: SignupStage) {
    if (signupStage.email_verified) return;

    throw new ForbiddenException({
      error_code: ERROR_CODES.EMAIL_NOT_VERIFIED,
      message: 'Not verified email. check your email and try again.',
    });
  }

  private async getSignupStageOrThrow(token: string) {
    const rawStage = await this.redis.get(this.getSignupStageKey(token));
    if (!rawStage) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_SIGNUP_TOKEN,
        message: 'Unexpected token.',
      });
    }

    return JSON.parse(rawStage) as SignupStage;
  }

  private async saveSignupStage(
    token: string,
    signupStage: SignupStage,
    ttlSeconds: number,
  ) {
    const key = this.getSignupStageKey(token);
    const value = JSON.stringify(signupStage);

    if (this.configService.get<string>('NODE_ENV') === 'test') {
      await this.redis.set(key, value);
      return;
    }

    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  private async sendSignupVerificationEmail(email: string, token: string) {
    try {
      await this.mailService.sendMail(
        email,
        'Verify Your Email',
        `Verify URL : ${this.getFrontendUrl()}/signup/verify?token=${token}`,
      );
    } catch {
      throw new InternalServerErrorException({
        error_code: ERROR_CODES.COULD_NOT_SEND_EMAIL,
        message: 'Failed to send email',
      });
    }
  }

  private async hashPassword(password: string) {
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  private async generateTokenPair(userId: string): Promise<AuthTokenPair> {
    const accessToken = await this.generateAccessToken(userId);
    const refreshToken = await this.generateRefreshToken(userId);
    return { accessToken, refreshToken };
  }

  private parseEmail(email: string) {
    const [localPart, domain, ...rest] = email.split('@');
    if (!localPart || !domain || rest.length > 0) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_EMAIL,
        message: 'Invalid email.',
      });
    }

    return { email, domain };
  }

  private toLoginProvider(provider: SsoProvider) {
    return provider === 'OIDC' ? LOGIN_PROVIDERS.OIDC : LOGIN_PROVIDERS.SAML;
  }

  private redirectToLogin(res: express.Response, errorCode: string) {
    return res.redirect(`${this.getFrontendUrl()}/login?error=${errorCode}`);
  }

  private sendSamlRedirectScript(res: express.Response, errorCode: string) {
    return res.send(`
        <script>
          window.location.href = '${this.getFrontendUrl()}/login?error=${errorCode}';
        </script>
      `);
  }

  private setRefreshTokenCookie(res: express.Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private getOidcRedirectUri() {
    return `${this.getRequiredConfig('BACKEND_URL')}/auth/sso/oidc/callback`;
  }

  private getFrontendUrl() {
    return this.getRequiredConfig('FRONTEND_URL');
  }

  private getSignupStageKey(token: string) {
    return `${SIGNUP_STAGE_PREFIX}:${token}`;
  }

  private getOidcStateKey(state: string) {
    return `${OIDC_STATE_PREFIX}:${state}`;
  }

  private getRefreshTokenKey(userId: string) {
    return `${REFRESH_TOKEN_PREFIX}:${userId}`;
  }

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

  private invalidCredentials() {
    return new BadRequestException({
      error_code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password.',
    });
  }

  private expiredToken() {
    return new ForbiddenException({
      error_code: ERROR_CODES.TOKEN_EXPIRED,
      message: 'Refresh token has expired or is invalid.',
    });
  }
}
