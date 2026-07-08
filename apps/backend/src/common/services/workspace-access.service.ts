import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ERROR_CODES } from '@repo/constants';
import { DataSource } from 'typeorm';
import { OrganizationUserEntity } from '@repo/database';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly dataSource: DataSource) {}

  // workspaceId를 받는 조회 API는 항상 이 경계를 먼저 통과해야 합니다.
  async assertAccess(userId: string, workspaceId: string): Promise<void> {
    if (!workspaceId?.trim()) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'workspaceId is required.',
      });
    }

    const membership = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .createQueryBuilder('membership')
      .innerJoin('membership.organization', 'organization')
      .innerJoin('organization.workspaces', 'workspace')
      .where('workspace.id = :workspaceId', { workspaceId })
      .andWhere('membership.userId = :userId', { userId })
      .getOne();

    if (!membership) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'You do not have access to this workspace.',
      });
    }
  }
}
