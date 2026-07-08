import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  CreateEmailVerificationDto,
  LoginDto,
  SignUpDto,
  VerifyEmailTokenDto,
} from '@repo/dto';
import { ERROR_CODES } from '@repo/constants';
import * as express from 'express';
import { AuthService } from './auth.service';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('/sso/login')
  async ssoLogin(@Query('email') email: string, @Res() res: express.Response) {
    return this.authService.handleSsoLogin(email, res);
  }

  @Get('/sso/oidc/callback')
  async oidcCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: express.Response,
  ) {
    return this.authService.handleOidcCallback(code, state, res);
  }

  @Post('/sso/saml/callback')
  samlCallback(
    @Body('SAMLResponse') samlResponse: string,
    @Res() res: express.Response,
  ) {
    return this.authService.handleSamlCallback(samlResponse, res);
  }

  @Post('/signup/create-verify')
  async createVerify(@Body() createVerifyDto: CreateEmailVerificationDto) {
    return this.authService.createEmailVerify(createVerifyDto);
  }

  @Post('/signup/verify')
  async verify(@Body() verifyEmailDto: VerifyEmailTokenDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('/signup')
  async signup(@Body() signUpDto: SignUpDto) {
    return this.authService.register(signUpDto);
  }

  @Post('/login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const tokenPair = await this.authService.login(loginDto);
    this.setRefreshTokenCookie(res, tokenPair.refreshToken);

    return {
      success: true,
      accessToken: tokenPair.accessToken,
    };
  }

  @Post('/refresh')
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = this.getRefreshToken(req);
    if (!refreshToken) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Refresh token is missing.',
      });
    }

    const tokenPair = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(res, tokenPair.refreshToken);

    return {
      success: true,
      accessToken: tokenPair.accessToken,
    };
  }

  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ success: true }> {
    const refreshToken = this.getRefreshToken(req);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE, this.getRefreshCookieOptions());
    return { success: true };
  }

  private getRefreshToken(req: express.Request): string | undefined {
    return this.getCookie(req, REFRESH_TOKEN_COOKIE);
  }

  private getCookie(req: express.Request, name: string): string | undefined {
    const cookies = req.headers.cookie ?? '';
    const rawValue = cookies
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.slice(name.length + 1);

    if (!rawValue) return undefined;

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  private setRefreshTokenCookie(res: express.Response, refreshToken: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    });
  }

  private getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
