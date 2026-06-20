/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import * as express from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    createEmailVerify: jest.fn(() => Promise.resolve({ success: true })),
    verifyEmail: jest.fn(() =>
      Promise.resolve({ success: true, email: 'user@test.com' }),
    ),
    register: jest.fn(() => Promise.resolve({ success: true })),
    login: jest.fn(() =>
      Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' }),
    ),
    refresh: jest.fn(() =>
      Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' }),
    ),
    logout: jest.fn(() => Promise.resolve({ success: true })),
    handleSsoLogin: jest.fn(),
    handleOidcCallback: jest.fn(),
    handleSamlCallback: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate createVerify to AuthService', async () => {
    const dto = { email: 'user@test.com' };
    await controller.createVerify(dto);
    expect(service.createEmailVerify).toHaveBeenCalledWith(dto);
  });

  it('should delegate verify to AuthService', async () => {
    const dto = { token: 'token' };
    await controller.verify(dto);
    expect(service.verifyEmail).toHaveBeenCalledWith(dto);
  });

  it('should delegate signup to AuthService', async () => {
    const dto = { token: 'token', name: 'User', password: 'password' };
    await controller.signup(dto);
    expect(service.register).toHaveBeenCalledWith(dto);
  });

  it('should delegate login to AuthService and set cookie', async () => {
    const dto = { email: 'user@test.com', password: 'password' };
    const res = {
      cookie: jest.fn(),
    } as unknown as express.Response;

    const result = await controller.login(dto, res);
    expect(service.login).toHaveBeenCalledWith(dto);
    expect(res.cookie).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('access');
  });

  it('should delegate refresh to AuthService and set cookie', async () => {
    const req = {
      headers: { cookie: 'refreshToken=old_refresh' },
    } as unknown as express.Request;
    const res = {
      cookie: jest.fn(),
    } as unknown as express.Response;

    const result = await controller.refresh(req, res);
    expect(service.refresh).toHaveBeenCalledWith('old_refresh');
    expect(res.cookie).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should delegate logout to AuthService and clear cookie', async () => {
    const req = {
      headers: { cookie: 'refreshToken=refresh' },
    } as unknown as express.Request;
    const res = {
      clearCookie: jest.fn(),
    } as unknown as express.Response;

    const result = await controller.logout(req, res);
    expect(service.logout).toHaveBeenCalledWith('refresh');
    expect(res.clearCookie).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should delegate ssoLogin to AuthService', async () => {
    const res = {} as express.Response;
    await controller.ssoLogin('user@test.com', res);
    expect(service.handleSsoLogin).toHaveBeenCalledWith('user@test.com', res);
  });

  it('should delegate oidcCallback to AuthService', async () => {
    const res = {} as express.Response;
    await controller.oidcCallback('code', 'state', res);
    expect(service.handleOidcCallback).toHaveBeenCalledWith(
      'code',
      'state',
      res,
    );
  });

  it('should delegate samlCallback to AuthService', async () => {
    const res = {} as express.Response;
    await controller.samlCallback('samlResponse', res);
    expect(service.handleSamlCallback).toHaveBeenCalledWith(
      'samlResponse',
      res,
    );
  });
});
