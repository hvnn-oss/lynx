import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrganizationUserEntity } from '@repo/database';

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async assertAccess(userId: string, workspaceId: string): Promise<void> {
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
        message: 'You do not have access to this workspace.',
      });
    }
  }
}
