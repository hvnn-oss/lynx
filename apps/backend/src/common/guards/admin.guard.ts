import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ERROR_CODES } from '@repo/constants';
import { AdminUserEntity } from '@repo/database';
import { Request } from 'express';
import { DataSource } from 'typeorm';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw this.forbidden();
    }

    const adminUser = await this.dataSource
      .getRepository(AdminUserEntity)
      .findOne({
        where: { user: { id: userId }, isActive: true },
        relations: { user: true },
      });

    if (!adminUser) {
      throw this.forbidden();
    }

    Object.assign(request, { adminUser });
    return true;
  }

  private forbidden() {
    return new ForbiddenException({
      error_code: ERROR_CODES.INVALID_INPUT,
      message: 'Admin permission is required.',
    });
  }
}
