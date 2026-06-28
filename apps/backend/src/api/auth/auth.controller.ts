import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  ForbiddenException,
  Get,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SignUpDto,
  CreateEmailVerificationDto,
  VerifyEmailTokenDto,
  LoginDto,
} from '@repo/dto';
import * as express from 'express';
import { ERROR_CODES } from '@repo/constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getCookie(req: express.Request, name: string): string | undefined {
    const cookiesStr = req.headers.cookie || '';
    const raw = cookiesStr
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.slice(name.length + 1);

    if (!raw) return undefined;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  // SSO 로그인을 시작하고 IdP의 로그인 페이지로 리다이렉트합니다.
  @Get('/sso/login')
  async ssoLogin(@Query('email') email: string, @Res() res: express.Response) {
    return await this.authService.handleSsoLogin(email, res);
  }

  // OIDC 인증 완료 콜백을 처리합니다.
  @Get('/sso/oidc/callback')
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: express.Response,
  ) {
    return await this.authService.handleOidcCallback(code, state, res);
  }

  // SAML 2.0 인증 완료 콜백을 처리합니다.
  @Post('/sso/saml/callback')
  samlCallback(
    @Body('SAMLResponse') samlResponse: string,
    @Res() res: express.Response,
  ) {
    return this.authService.handleSamlCallback(samlResponse, res);
  }

  // 이메일 인증 메일 발송 요청을 처리합니다.
  @Post('/signup/create-verify')
  async createVerify(@Body() createVerifyDto: CreateEmailVerificationDto) {
    return await this.authService.createEmailVerify(createVerifyDto);
  }

  // 이메일 가입 링크의 토큰 검증을 처리합니다.
  @Post('/signup/verify')
  async verify(@Body() verifyEmailDto: VerifyEmailTokenDto) {
    return await this.authService.verifyEmail(verifyEmailDto);
  }

  // 가입 완료 계정 및 조직 생성을 처리합니다.
  @Post('/signup')
  async signup(@Body() signUpDto: SignUpDto) {
    return await this.authService.register(signUpDto);
  }

  // 로컬 로그인을 처리하고 Refresh Token을 쿠키에 설정합니다.
  @Post('/login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.login(loginDto);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      accessToken: result.accessToken,
    };
  }

  // 세션 연장을 위한 Refresh Token 검증 및 갱신을 처리합니다.
  @Post('/refresh')
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = this.getCookie(req, 'refreshToken');

    if (!refreshToken) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Refresh token is missing.',
      });
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      accessToken: result.accessToken,
    };
  }

  // 사용자 로그아웃을 처리하고 관련 쿠키를 정리합니다.
  @Post('/logout')
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = this.getCookie(req, 'refreshToken');

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: true,
    };
  }
}
