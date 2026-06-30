import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationEntity,
  OrganizationUserEntity,
  UserEntity,
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
  CreatedWorkspaceApiKeyDto,
  CreateWorkspaceApiKeyDto,
  CreateWorkspaceDto,
  SuccessResponseDto,
  UpdateWorkspaceApiKeyDto,
  UpdateWorkspaceDto,
  WorkspaceApiKeyDto,
  WorkspaceApiKeyPermission,
  WorkspaceApiKeyResponseDto,
  WorkspaceDetailDto,
  WorkspacePlanConfigDto,
  WorkspaceSummaryDto,
} from '@repo/dto';

const workspaceManagers: UserPermissions[] = [
  USER_PERMISSIONS.OWNER,
  USER_PERMISSIONS.ADMIN,
];

const allApiKeyScopes = ['events:write', 'config:read', 'policies:read'];
const restrictedApiKeyScopes = ['events:write'];
const readOnlyApiKeyScopes = ['config:read', 'policies:read'];
const allowedApiKeyScopes = new Set(allApiKeyScopes);

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
    const planCode = await this.resolveActivePlanCode(WORKSPACE_PLANS.FREE);

    return await this.dataSource.transaction(async (manager) => {
      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const workspace = workspaceRepository.create({
        name: dto.name,
        plan: planCode,
        organization,
      });

      await workspaceRepository.save(workspace);
      const apiKey = await this.createWorkspaceApiKey(manager, workspace, {
        name: 'Default ingest key',
        createdByUserId: userId,
        createdByName: await this.getUserName(userId),
      });
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
      const apiKey = await this.createWorkspaceApiKey(manager, workspace, {
        name: 'Rotated ingest key',
        createdByUserId: userId,
        createdByName: await this.getUserName(userId),
      });

      return {
        workspaceId: workspace.id,
        apiKey,
      };
    });
  }

  async listApiKeys(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceApiKeyDto[]> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(workspace.organization.id, userId);

    const apiKeys = await this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .find({
        where: { workspace: { id: workspace.id } },
        order: { createdAt: 'DESC' },
      });

    return apiKeys.map((apiKey) => this.toWorkspaceApiKeyDto(apiKey));
  }

  async createApiKey(
    workspaceId: string,
    userId: string,
    dto: CreateWorkspaceApiKeyDto,
  ): Promise<CreatedWorkspaceApiKeyDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(
      workspace.organization.id,
      userId,
      workspaceManagers,
    );

    const createdByName = await this.getUserName(userId);

    return await this.dataSource.transaction(async (manager) => {
      const apiKey = await this.createWorkspaceApiKey(manager, workspace, {
        name: this.normalizeApiKeyName(dto.name),
        scopes: this.resolveApiKeyScopes(dto.permission, dto.scopes),
        createdByUserId: userId,
        createdByName,
      });
      const entity = await manager.getRepository(WorkspaceApiKeyEntity).findOne({
        where: { keyHash: this.hashApiKey(apiKey) },
      });

      if (!entity) {
        throw new NotFoundException({
          error_code: ERROR_CODES.INVALID_INPUT,
          message: 'Created API key could not be loaded.',
        });
      }

      return {
        workspaceId: workspace.id,
        apiKey,
        key: this.toWorkspaceApiKeyDto(entity),
      };
    });
  }

  async updateApiKey(
    workspaceId: string,
    apiKeyId: string,
    userId: string,
    dto: UpdateWorkspaceApiKeyDto,
  ): Promise<WorkspaceApiKeyDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(
      workspace.organization.id,
      userId,
      workspaceManagers,
    );

    const apiKey = await this.findWorkspaceApiKeyOrThrow(workspace.id, apiKeyId);
    if (apiKey.revokedAt) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Revoked API keys cannot be edited.',
      });
    }

    if (dto.name !== undefined) {
      apiKey.name = this.normalizeApiKeyName(dto.name);
    }
    if (dto.permission !== undefined || dto.scopes !== undefined) {
      apiKey.scopes = this.resolveApiKeyScopes(dto.permission, dto.scopes);
    }

    const saved = await this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .save(apiKey);

    return this.toWorkspaceApiKeyDto(saved);
  }

  async revokeApiKey(
    workspaceId: string,
    apiKeyId: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const workspace = await this.findWorkspaceOrThrow(workspaceId);
    await this.assertOrganizationRole(
      workspace.organization.id,
      userId,
      workspaceManagers,
    );

    const apiKey = await this.findWorkspaceApiKeyOrThrow(workspace.id, apiKeyId);
    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await this.dataSource.getRepository(WorkspaceApiKeyEntity).save(apiKey);
    }

    return { success: true };
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

  private async findWorkspaceApiKeyOrThrow(
    workspaceId: string,
    apiKeyId: string,
  ): Promise<WorkspaceApiKeyEntity> {
    const apiKey = await this.dataSource
      .getRepository(WorkspaceApiKeyEntity)
      .findOne({
        where: { id: apiKeyId, workspace: { id: workspaceId } },
      });

    if (!apiKey) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Workspace API key not found.',
      });
    }

    return apiKey;
  }

  private async getUserName(userId: string): Promise<string | undefined> {
    const user = await this.dataSource
      .getRepository(UserEntity)
      .findOne({ where: { id: userId } });

    return user?.name ?? user?.email;
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
    options: {
      name?: string;
      scopes?: string[];
      createdByUserId?: string;
      createdByName?: string;
    } = {},
  ): Promise<string> {
    const apiKey = this.generateApiKey();
    await manager.getRepository(WorkspaceApiKeyEntity).save({
      prefix: apiKey.slice(0, 16),
      keyHash: this.hashApiKey(apiKey),
      name: options.name ?? 'Ingest key',
      scopes: options.scopes ?? restrictedApiKeyScopes,
      createdByUserId: options.createdByUserId,
      createdByName: options.createdByName,
      workspace,
    });

    return apiKey;
  }

  private normalizeApiKeyName(name: string | undefined): string {
    const trimmedName = name?.trim();
    return trimmedName || 'Untitled API key';
  }

  private resolveApiKeyScopes(
    permission: WorkspaceApiKeyPermission | undefined,
    scopes: string[] | undefined,
  ): string[] {
    if (scopes && scopes.length > 0) {
      const normalizedScopes = Array.from(
        new Set(scopes.map((scope) => scope.trim())),
      ).filter((scope) => allowedApiKeyScopes.has(scope));

      if (normalizedScopes.length === 0) {
        throw new BadRequestException({
          error_code: ERROR_CODES.INVALID_INPUT,
          message: 'API key scope is not allowed.',
        });
      }

      return normalizedScopes;
    }

    if (permission === 'ALL') return allApiKeyScopes;
    if (permission === 'READ_ONLY') return readOnlyApiKeyScopes;
    return restrictedApiKeyScopes;
  }

  private resolveApiKeyPermission(
    scopes: string[],
  ): WorkspaceApiKeyPermission {
    const scopeSet = new Set(scopes);
    if (
      allApiKeyScopes.every((scope) => scopeSet.has(scope)) &&
      scopeSet.size >= allApiKeyScopes.length
    ) {
      return 'ALL';
    }
    if (
      readOnlyApiKeyScopes.every((scope) => scopeSet.has(scope)) &&
      !scopeSet.has('events:write')
    ) {
      return 'READ_ONLY';
    }
    return 'RESTRICTED';
  }

  private toWorkspaceApiKeyDto(
    apiKey: WorkspaceApiKeyEntity,
  ): WorkspaceApiKeyDto {
    return {
      id: apiKey.id,
      trackingId: `key_${apiKey.id.replace(/-/g, '').slice(0, 20)}`,
      name: apiKey.name ?? 'Untitled API key',
      status: this.getApiKeyStatus(apiKey),
      prefix: apiKey.prefix,
      secretPreview: `${apiKey.prefix}...`,
      scopes: apiKey.scopes,
      permission: this.resolveApiKeyPermission(apiKey.scopes),
      createdAt: apiKey.createdAt.toISOString(),
      lastUsedAt: apiKey.lastUsedAt?.toISOString(),
      revokedAt: apiKey.revokedAt?.toISOString(),
      expiresAt: apiKey.expiresAt?.toISOString(),
      createdByName: apiKey.createdByName,
      monthlySpend: 0,
    };
  }

  private getApiKeyStatus(
    apiKey: WorkspaceApiKeyEntity,
  ): WorkspaceApiKeyDto['status'] {
    if (apiKey.revokedAt) return 'REVOKED';
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      return 'EXPIRED';
    }
    return 'ACTIVE';
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
