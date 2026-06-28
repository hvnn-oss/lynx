/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../providers/redis/redis.constants';
import { MailerService } from '../../providers/smtp/mail.service';
import {
  OrganizationDomainEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  UserAccountEntity,
  UserEntity,
  OidcAccountEntity,
} from '@repo/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LOGIN_PROVIDERS } from '@repo/constants';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  genSalt: jest.fn(() => Promise.resolve('salt')),
  hash: jest.fn(() => Promise.resolve('hashed')),
  compare: jest.fn(() => Promise.resolve(true)),
}));

describe('AuthService', () => {
  let service: AuthService;

  // Mock repositories
  const mockDomainRepo = {
    findOne: jest.fn(),
  };
  const mockOrgRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
  const mockOrgUserRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
  const mockUserAccountRepo = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
  const mockUserRepo = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
  const mockOidcAccountRepo = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };

  const mockEntityManager = {
    getRepository: jest.fn((entity) => {
      if (entity === OrganizationDomainEntity) return mockDomainRepo;
      if (entity === OrganizationEntity) return mockOrgRepo;
      if (entity === OrganizationUserEntity) return mockOrgUserRepo;
      if (entity === UserAccountEntity) return mockUserAccountRepo;
      if (entity === UserEntity) return mockUserRepo;
      if (entity === OidcAccountEntity) return mockOidcAccountRepo;
      return {};
    }),
  };

  const mockDataSource = {
    getRepository: jest.fn((entity) => {
      if (entity === OrganizationDomainEntity) return mockDomainRepo;
      if (entity === OrganizationEntity) return mockOrgRepo;
      if (entity === OrganizationUserEntity) return mockOrgUserRepo;
      if (entity === UserAccountEntity) return mockUserAccountRepo;
      if (entity === UserEntity) return mockUserRepo;
      if (entity === OidcAccountEntity) return mockOidcAccountRepo;
      return {};
    }),
    transaction: jest.fn((cb) => cb(mockEntityManager)),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(() => Promise.resolve()),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'FRONTEND_URL') return 'http://frontend';
      if (key === 'BACKEND_URL') return 'http://backend';
      if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      if (key === 'NODE_ENV') return 'test';
      return null;
    }),
  };

  const mockJwtService = {
    signAsync: jest.fn(() => Promise.resolve('mock_token')),
    verifyAsync: jest.fn(() =>
      Promise.resolve({ sub: 'user_id', jti: 'jti_id' }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmailVerify', () => {
    it('should throw ForbiddenException if organization forces SSO', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);
      mockDomainRepo.findOne.mockResolvedValue({
        organization: { forceSSO: true },
      });

      await expect(
        service.createEmailVerify({ email: 'user@org.com' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if user already exists', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({ id: 'user-id' });

      await expect(
        service.createEmailVerify({ email: 'user@org.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should save verification token to redis and send email', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);
      mockDomainRepo.findOne.mockResolvedValue(null);

      const result = await service.createEmailVerify({
        email: 'user@test.com',
      });
      expect(result.success).toBe(true);
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockMailerService.sendMail).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should throw NotFoundException if verification token not found in redis', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ token: 'invalid-token' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update verification status in redis and return email', async () => {
      const pendingData = {
        email: 'user@test.com',
        domain: 'test.com',
        email_verified: false,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(pendingData));

      const result = await service.verifyEmail({ token: 'valid-token' });
      expect(result.success).toBe(true);
      expect(result.email).toBe('user@test.com');
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should throw NotFoundException if signup token is invalid', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.register({
          token: 'invalid-token',
          name: 'User',
          password: 'password123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if email is not verified', async () => {
      const unverifiedData = {
        email: 'user@test.com',
        domain: 'test.com',
        email_verified: false,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(unverifiedData));

      await expect(
        service.register({
          token: 'token',
          name: 'User',
          password: 'password123',
          organization_info: { name: 'My Org' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully save user and organization in a transaction', async () => {
      const verifiedData = {
        email: 'user@test.com',
        domain: 'test.com',
        email_verified: true,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(verifiedData));
      mockDomainRepo.findOne.mockResolvedValue(null);

      const result = await service.register({
        token: 'token',
        name: 'User',
        password: 'password123',
        organization_info: { name: 'My Org' },
      });

      expect(result.success).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('signup:stage:token');
    });
  });

  describe('login', () => {
    it('should throw BadRequestException if user does not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'password' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if organization forces SSO', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-id', accounts: [] });
      mockDomainRepo.findOne.mockResolvedValue({
        organization: { forceSSO: true },
      });

      await expect(
        service.login({ email: 'user@org.com', password: 'password' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if local password validation fails', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        accounts: [{ provider: LOGIN_PROVIDERS.LOCAL, passwordHash: 'hash' }],
      });
      mockDomainRepo.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@test.com', password: 'wrong' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return token pair on successful login', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        accounts: [{ provider: LOGIN_PROVIDERS.LOCAL, passwordHash: 'hash' }],
      });
      mockDomainRepo.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'user@test.com',
        password: 'correct',
      });
      expect(result.accessToken).toBe('mock_token');
      expect(result.refreshToken).toBe('mock_token');
    });
  });

  describe('handleSsoLogin', () => {
    const mockRes = {
      redirect: jest.fn(),
    } as unknown as any;

    it('should redirect to frontend warning if SSO is not configured', async () => {
      mockDomainRepo.findOne.mockResolvedValue(null);

      await service.handleSsoLogin('user@test.com', mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend/login?error=sso-not-configured',
      );
    });

    it('should redirect to OIDC authorization endpoint if OIDC is configured', async () => {
      mockDomainRepo.findOne.mockResolvedValue({
        organization: {
          id: 'org-id',
          useSso: true,
          oidcIssuer: 'https://oidc-issuer',
          oidcClientId: 'client-id',
        },
      });

      const mockDiscovery = {
        authorization_endpoint: 'https://oidc-issuer/auth',
      };
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockDiscovery),
        }),
      );

      await service.handleSsoLogin('user@org.com', mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://oidc-issuer/auth?response_type=code'),
      );
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should reject SAML login until signed assertion validation is implemented', async () => {
      mockDomainRepo.findOne.mockResolvedValue({
        organization: {
          id: 'org-id',
          useSso: true,
          samlEntryPoint: 'https://saml-entry',
          samlIssuer: 'saml-issuer',
        },
      });

      await service.handleSsoLogin('user@saml.com', mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend/login?error=saml-validation-required',
      );
    });
  });

  describe('handleOidcCallback', () => {
    const mockRes = {
      cookie: jest.fn(),
      redirect: jest.fn(),
    } as unknown as any;

    it('should redirect with error if state is invalid', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.handleOidcCallback('code', 'invalid-state', mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend/login?error=sso-invalid-state',
      );
    });

    it('should successfully sign in the OIDC user', async () => {
      const stateData = { email: 'user@oidc.com', orgId: 'org-id' };
      mockRedis.get.mockResolvedValue(JSON.stringify(stateData));

      mockOrgRepo.findOne.mockResolvedValue({
        id: 'org-id',
        oidcIssuer: 'https://oidc-issuer',
        oidcClientId: 'client-id',
        oidcClientSecret: 'client-secret',
      });

      // Mock fetch sequence for discovery, token, and userinfo
      const mockDiscovery = {
        token_endpoint: 'https://oidc-issuer/token',
        userinfo_endpoint: 'https://oidc-issuer/userinfo',
      };
      const mockToken = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };
      const mockProfile = { sub: 'oidc-sub', email: 'user@oidc.com' };

      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({ json: () => Promise.resolve(mockDiscovery) }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({ json: () => Promise.resolve(mockToken) }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({ json: () => Promise.resolve(mockProfile) }),
        );

      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-id',
        accounts: [],
      });

      await service.handleOidcCallback('code', 'state', mockRes);
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend/dashboard?sso=success',
      );
    });
  });

  describe('handleSamlCallback', () => {
    const mockRes = {
      cookie: jest.fn(),
      send: jest.fn(),
    } as unknown as any;

    it('should reject SAML callback until signed assertion validation is implemented', async () => {
      const invalidResponse = Buffer.from('<xml></xml>').toString('base64');

      await service.handleSamlCallback(invalidResponse, mockRes);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('error=saml-validation-required'),
      );
    });

    it('should not sign in a SAML user without assertion validation', async () => {
      const mockAssertion = `<samlp:Response><saml:Assertion><saml:Subject><saml:NameID>user@saml.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>`;
      const validResponse = Buffer.from(mockAssertion).toString('base64');

      mockDomainRepo.findOne.mockResolvedValue({
        organization: { id: 'org-id', useSso: true },
      });
      mockUserRepo.findOne.mockResolvedValue(null); // Register new user
      mockOrgRepo.findOneBy.mockResolvedValue({ id: 'org-id' });

      await service.handleSamlCallback(validResponse, mockRes);
      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.stringContaining('error=saml-validation-required'),
      );
    });
  });
});
