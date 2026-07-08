import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AdminUserEntity } from '@repo/database';
import type { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: { sub: string };
  adminUser?: AdminUserEntity;
};

// 컨트롤러가 req.user 구조를 몰라도 현재 사용자 ID만 받을 수 있게 합니다.
export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user is missing.');
    }

    return userId;
  },
);

// AdminGuard가 붙인 관리자 정보를 컨트롤러 파라미터로 바로 꺼냅니다.
export const CurrentAdminUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminUserEntity => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const adminUser = request.adminUser;
    if (!adminUser) {
      throw new ForbiddenException('Admin context is missing.');
    }

    return adminUser;
  },
);
