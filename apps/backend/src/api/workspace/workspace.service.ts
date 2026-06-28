import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntity,
  OrganizationUserEntity,
  WorkspaceEntity,
} from '@repo/database';
import { DataSource } from 'typeorm';
import {
  ERROR_CODES,
  USER_PERMISSIONS,
  WORKSPACE_PLANS,
  type UserPermissions,
} from '@repo/constants';
import type {
  CreateWorkspaceDto,
  SuccessResponseDto,
  UpdateWorkspaceDto,
  WorkspaceApiKeyResponseDto,
  WorkspaceDetailDto,
  WorkspaceSummaryDto,
} from '@repo/dto';

const workspaceManagers: UserPermissions[] = [
  USER_PERMISSIONS.OWNER,
  USER_PERMISSIONS.ADMIN,
];

@Injectable()
export class WorkspaceService {
  constructor(private readonly dataSource: DataSource) {}

  async listWorkspaces(userId: string): Promise<WorkspaceSummaryDto[]> {
    const memberships = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .find({
        where: { user: { id: userId } },
        relations: {
          organization: {
            workspaces: true,
          },
        },
      });

    return memberships.flatMap((membership) =>
      (membership.organization.workspaces ?? []).map((workspace) =>
        this.toWorkspaceSummary(workspace, membership.organization),
      ),
    );
  }

  async createWorkspace(
    userId: string,
    dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDetailDto> {
    await this.assertOrganizationRole(
      dto.organizationId,
      userId,
      workspaceManagers,
    );

    const organization = await this.findOrganizationOrThrow(dto.organizationId);
    const workspaceRepository = this.dataSource.getRepository(WorkspaceEntity);
    const workspace = workspaceRepository.create({
      name: dto.name,
      plan: dto.plan ?? WORKSPACE_PLANS.FREE,
      apiKey: this.generateApiKey(),
      organization,
    });

    await workspaceRepository.save(workspace);
    return this.toWorkspaceDetail(workspace, organization);
  }

  async getWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceDetailDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(workspace.organization.id, userId);
    return this.toWorkspaceDetail(workspace, workspace.organization);
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDetailDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(
      workspace.organization.id,
      userId,
      workspaceManagers,
    );

    if (dto.name !== undefined) workspace.name = dto.name;
    if (dto.plan !== undefined) workspace.plan = dto.plan;

    await this.dataSource.getRepository(WorkspaceEntity).save(workspace);
    return this.toWorkspaceDetail(workspace, workspace.organization);
  }

  async deleteWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(
      workspace.organization.id,
      userId,
      workspaceManagers,
    );

    await this.dataSource.getRepository(WorkspaceEntity).remove(workspace);
    return { success: true };
  }

  async rotateApiKey(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceApiKeyResponseDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(
      workspace.organization.id,
      userId,
      workspaceManagers,
    );

    workspace.apiKey = this.generateApiKey();
    await this.dataSource.getRepository(WorkspaceEntity).save(workspace);

    return {
      workspaceId: workspace.id,
      apiKey: workspace.apiKey,
    };
  }

  private async assertOrganizationRole(
    organizationId: string,
    userId: string,
    allowedRoles?: UserPermissions[],
  ): Promise<OrganizationUserEntity> {
    const membership = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .findOne({
        where: { organization: { id: organizationId }, user: { id: userId } },
      });

    if (!membership) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'You do not have access to this organization.',
      });
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'You do not have permission to manage this workspace.',
      });
    }

    return membership;
  }

  private async findOrganizationOrThrow(
    organizationId: string,
  ): Promise<OrganizationEntity> {
    const organization = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({ where: { id: organizationId } });

    if (!organization) {
      throw new NotFoundException({
        error_code: ERROR_CODES.ORG_NOT_FOUND,
        message: 'Organization not found.',
      });
    }

    return organization;
  }

  private async findWorkspaceOrThrow(
    workspaceId: string,
  ): Promise<WorkspaceEntity> {
    const workspace = await this.dataSource
      .getRepository(WorkspaceEntity)
      .findOne({
        where: { id: workspaceId },
        relations: { organization: true },
      });

    if (!workspace) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Workspace not found.',
      });
    }

    return workspace;
  }

  private toWorkspaceSummary(
    workspace: WorkspaceEntity,
    organization: OrganizationEntity,
  ): WorkspaceSummaryDto {
    return {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      organization: {
        id: organization.id,
        name: organization.name,
      },
    };
  }

  private toWorkspaceDetail(
    workspace: WorkspaceEntity,
    organization: OrganizationEntity,
  ): WorkspaceDetailDto {
    return {
      ...this.toWorkspaceSummary(workspace, organization),
      apiKey: workspace.apiKey,
    };
  }

  private generateApiKey(): string {
    return `lynx_${crypto.randomUUID().replace(/-/g, '')}`;
  }
}
