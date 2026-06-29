import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntity,
  OrganizationUserEntity,
  WorkspaceApiKeyEntity,
  WorkspaceEntity,
  WorkspacePlanEntity,
} from '@repo/database';
import { randomBytes, createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
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
  WorkspacePlanConfigDto,
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
            workspaces: {
              planConfig: true,
            },
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
    const planCode = await this.resolveActivePlanCode(
      dto.plan ?? WORKSPACE_PLANS.FREE,
    );

    return await this.dataSource.transaction(async (manager) => {
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const workspace = workspaceRepository.create({
        name: dto.name,
        plan: planCode,
        organization,
      });

      await workspaceRepository.save(workspace);
      const apiKey = await this.createWorkspaceApiKey(manager, workspace);
      return this.toWorkspaceDetail(workspace, organization, apiKey);
    });
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
    if (dto.plan !== undefined) {
      workspace.plan = await this.resolveActivePlanCode(dto.plan);
    }

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

    return await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(WorkspaceApiKeyEntity)
        .createQueryBuilder()
        .update(WorkspaceApiKeyEntity)
        .set({ revokedAt: new Date() })
        .where('"workspaceId" = :workspaceId', { workspaceId: workspace.id })
        .andWhere('"revokedAt" IS NULL')
        .execute();
      const apiKey = await this.createWorkspaceApiKey(manager, workspace);

      return {
        workspaceId: workspace.id,
        apiKey,
      };
    });
  }

  private async resolveActivePlanCode(planCode: string): Promise<string> {
    const normalizedCode = planCode.trim().toUpperCase();
    const plan = await this.dataSource
      .getRepository(WorkspacePlanEntity)
      .findOne({
        where: { code: normalizedCode, isActive: true },
      });

    if (!plan) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Active workspace plan not found.',
      });
    }

    return plan.code;
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
        relations: { organization: true, planConfig: true },
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
      planConfig: workspace.planConfig
        ? this.toWorkspacePlanConfig(workspace.planConfig)
        : undefined,
    };
  }

  private toWorkspaceDetail(
    workspace: WorkspaceEntity,
    organization: OrganizationEntity,
    apiKey?: string,
  ): WorkspaceDetailDto {
    return {
      ...this.toWorkspaceSummary(workspace, organization),
      apiKey,
    };
  }

  private generateApiKey(): string {
    return `lynx_${randomBytes(32).toString('base64url')}`;
  }

  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private async createWorkspaceApiKey(
    manager: DataSource | EntityManager,
    workspace: WorkspaceEntity,
  ): Promise<string> {
    const apiKey = this.generateApiKey();
    await manager.getRepository(WorkspaceApiKeyEntity).save({
      prefix: apiKey.slice(0, 16),
      keyHash: this.hashApiKey(apiKey),
      name: 'Default ingest key',
      scopes: ['events:write'],
      workspace,
    });

    return apiKey;
  }

  private toWorkspacePlanConfig(
    plan: NonNullable<WorkspaceEntity['planConfig']>,
  ): WorkspacePlanConfigDto {
    return {
      code: plan.code,
      name: plan.name,
      retentionDays: plan.retentionDays,
      monthlyEventLimit: plan.monthlyEventLimit,
      includedLogCount: plan.includedLogCount,
      logOverageUnitPrice: this.toOptionalNumber(plan.logOverageUnitPrice),
      features: plan.features,
      isActive: plan.isActive,
    };
  }

  private toOptionalNumber(
    value: number | string | undefined,
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return Number(value);
  }
}
