import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ERROR_CODES, AccessTokenPayload } from '@repo/constants';

// JWT Access Token의 유효성을 검증하는 보안 가드 컴포넌트입니다.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Authorization 헤더 형식 검증
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error_code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Missing or invalid token.',
      });
    }

    const token = authHeader.split(' ')[1];
    try {
      // Access Token 복호화 및 서명 검증
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.getRequiredConfig('JWT_ACCESS_SECRET'),
        },
      );
      Object.assign(request, { user: payload });
      return true;
    } catch {
      throw new UnauthorizedException({
        error_code: ERROR_CODES.TOKEN_EXPIRED,
        message: 'Token has expired or is invalid.',
      });
    }
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
}
