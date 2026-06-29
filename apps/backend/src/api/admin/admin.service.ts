import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ADMIN_ROLES, ERROR_CODES, type AdminRole } from '@repo/constants';
import {
  AdminAuditLogEntity,
  AdminUserEntity,
  OrganizationEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspacePlanEntity,
} from '@repo/database';
import type {
  AdminDashboardDto,
  AdminCreatePlanDto,
  AdminMeDto,
  AdminOrganizationDto,
  AdminOrganizationSearchItemDto,
  AdminOrganizationSearchQueryDto,
  AdminOrganizationSearchResponseDto,
  AdminPlanDto,
  AdminUpdateOrganizationDto,
  AdminUpdatePlanDto,
  AdminUpdateUserDto,
  AdminUpdateWorkspaceDto,
  AdminUserDto,
  AdminWorkspaceDto,
} from '@repo/dto';
import { DataSource } from 'typeorm';

const ADMIN_LIST_LIMIT = 50;
const ADMIN_ORGANIZATION_SEARCH_LIMIT = 10;

@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  async getMe(userId: string): Promise<AdminMeDto> {
    const adminUser = await this.findAdminUserOrThrow(userId);
    return this.toAdminMe(adminUser);
  }

  async getDashboard(userId: string): Promise<AdminDashboardDto> {
    const me = await this.getMe(userId);
    const planRepository = this.dataSource.getRepository(WorkspacePlanEntity);
    const userRepository = this.dataSource.getRepository(UserEntity);
    const organizationRepository =
      this.dataSource.getRepository(OrganizationEntity);
    const workspaceRepository = this.dataSource.getRepository(WorkspaceEntity);

    const [plans, users, organizations, workspaces] = await Promise.all([
      planRepository.find({ order: { code: 'ASC' } }),
      userRepository.find({
        order: { createdAt: 'DESC' },
        take: ADMIN_LIST_LIMIT,
      }),
      organizationRepository.find({
        relations: { users: true, workspaces: true },
        take: ADMIN_LIST_LIMIT,
      }),
      workspaceRepository.find({
        relations: { organization: true, planConfig: true },
        take: ADMIN_LIST_LIMIT,
      }),
    ]);

    return {
      me,
      counts: {
        plans: await planRepository.count(),
        users: await userRepository.count(),
        organizations: await organizationRepository.count(),
        workspaces: await workspaceRepository.count(),
      },
      plans: plans.map((plan) => this.toPlanDto(plan)),
      users: users.map((user) => this.toUserDto(user)),
      organizations: organizations.map((organization) =>
        this.toOrganizationDto(organization),
      ),
      workspaces: workspaces.map((workspace) => this.toWorkspaceDto(workspace)),
    };
  }

  async searchOrganizations(
    userId: string,
    query: AdminOrganizationSearchQueryDto,
  ): Promise<AdminOrganizationSearchResponseDto> {
    await this.findAdminUserOrThrow(userId);

    const limit = Math.min(
      Math.max(query.limit ?? ADMIN_ORGANIZATION_SEARCH_LIMIT, 1),
      ADMIN_ORGANIZATION_SEARCH_LIMIT,
    );
    const searchText = query.query?.trim() ?? '';
    const organizationRepository =
      this.dataSource.getRepository(OrganizationEntity);
    const queryBuilder = organizationRepository
      .createQueryBuilder('organization')
      .leftJoinAndSelect('organization.users', 'organizationUser')
      .leftJoinAndSelect('organization.workspaces', 'workspace')
      .leftJoinAndSelect('workspace.planConfig', 'workspacePlan')
      .orderBy('organization.name', 'ASC')
      .take(limit);

    if (searchText) {
      queryBuilder.where(
        '(LOWER(organization.name) LIKE :search OR CAST(organization.id AS TEXT) LIKE :search)',
        { search: `%${searchText.toLowerCase()}%` },
      );
    }

    const organizations = await queryBuilder.getMany();

    return {
      query: searchText,
      limit,
      organizations: organizations.map((organization) =>
        this.toOrganizationSearchItemDto(organization),
      ),
    };
  }

  async updatePlan(
    actorUserId: string,
    code: string,
    dto: AdminUpdatePlanDto,
  ): Promise<AdminPlanDto> {
    const normalizedCode = code.toUpperCase();
    const planRepository = this.dataSource.getRepository(WorkspacePlanEntity);
    const plan = await planRepository.findOne({
      where: { code: normalizedCode },
    });

    if (!plan) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Plan not found.',
      });
    }

    const before = this.toPlanDto(plan);
    plan.name = dto.name;
    plan.retentionDays = dto.retentionDays;
    plan.monthlyEventLimit = dto.monthlyEventLimit;
    plan.includedLogCount = dto.includedLogCount;
    plan.logOverageUnitPrice = dto.logOverageUnitPrice;
    plan.maxMembers = undefined;
    plan.features = dto.features;
    plan.isActive = dto.isActive;

    await planRepository.save(plan);
    const after = this.toPlanDto(plan);
    await this.writeAuditLog(actorUserId, 'admin.plan.update', 'plan', code, {
      before: this.toAuditPayload(before),
      after: this.toAuditPayload(after),
    });

    return after;
  }

  async createPlan(
    actorUserId: string,
    actorRole: AdminRole,
    dto: AdminCreatePlanDto,
  ): Promise<AdminPlanDto> {
    this.assertSuperAdmin(actorRole);

    const code = dto.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Plan code must use only A-Z, 0-9, underscore, or dash.',
      });
    }

    const planRepository = this.dataSource.getRepository(WorkspacePlanEntity);
    const existingPlan = await planRepository.findOne({ where: { code } });
    if (existingPlan) {
      throw new ConflictException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Plan code already exists.',
      });
    }

    const plan = planRepository.create({
      code,
      name: dto.name,
      retentionDays: dto.retentionDays,
      monthlyEventLimit: dto.monthlyEventLimit,
      includedLogCount: dto.includedLogCount,
      logOverageUnitPrice: dto.logOverageUnitPrice,
      maxMembers: undefined,
      features: dto.features,
      isActive: dto.isActive,
    });

    await planRepository.save(plan);
    const after = this.toPlanDto(plan);
    await this.writeAuditLog(actorUserId, 'admin.plan.create', 'plan', code, {
      after: this.toAuditPayload(after),
    });

    return after;
  }

  async updateUser(
    actorUserId: string,
    userId: string,
    dto: AdminUpdateUserDto,
  ): Promise<AdminUserDto> {
    const userRepository = this.dataSource.getRepository(UserEntity);
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'User not found.',
      });
    }

    const existingEmailUser = await userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingEmailUser && existingEmailUser.id !== user.id) {
      throw new ConflictException({
        error_code: ERROR_CODES.INVALID_EMAIL,
        message: 'Email is already used by another user.',
      });
    }

    const before = this.toUserDto(user);
    user.email = dto.email;
    user.name = dto.name;

    await userRepository.save(user);
    const after = this.toUserDto(user);
    await this.writeAuditLog(actorUserId, 'admin.user.update', 'user', userId, {
      before: this.toAuditPayload(before),
      after: this.toAuditPayload(after),
    });

    return after;
  }

  async updateOrganization(
    actorUserId: string,
    organizationId: string,
    dto: AdminUpdateOrganizationDto,
  ): Promise<AdminOrganizationDto> {
    if (dto.forceSSO && !dto.useSso) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'forceSSO can only be enabled when useSso is enabled.',
      });
    }

    const organizationRepository =
      this.dataSource.getRepository(OrganizationEntity);
    const organization = await organizationRepository.findOne({
      where: { id: organizationId },
      relations: { users: true, workspaces: true },
    });

    if (!organization) {
      throw new NotFoundException({
        error_code: ERROR_CODES.ORG_NOT_FOUND,
        message: 'Organization not found.',
      });
    }

    const before = this.toOrganizationDto(organization);
    organization.name = dto.name;
    organization.useSso = dto.useSso;
    organization.forceSSO = dto.forceSSO;
    organization.oidcIssuer = dto.oidcIssuer || undefined;
    organization.oidcClientId = dto.oidcClientId || undefined;

    await organizationRepository.save(organization);
    const reloaded = await organizationRepository.findOneOrFail({
      where: { id: organizationId },
      relations: { users: true, workspaces: true },
    });
    const after = this.toOrganizationDto(reloaded);
    await this.writeAuditLog(
      actorUserId,
      'admin.organization.update',
      'organization',
      organizationId,
      {
        before: this.toAuditPayload(before),
        after: this.toAuditPayload(after),
      },
    );

    return after;
  }

  async updateWorkspace(
    actorUserId: string,
    workspaceId: string,
    dto: AdminUpdateWorkspaceDto,
  ): Promise<AdminWorkspaceDto> {
    const workspaceRepository = this.dataSource.getRepository(WorkspaceEntity);
    const organizationRepository =
      this.dataSource.getRepository(OrganizationEntity);
    const planRepository = this.dataSource.getRepository(WorkspacePlanEntity);

    const workspace = await workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { organization: true, planConfig: true },
    });
    if (!workspace) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Workspace not found.',
      });
    }

    const organization = await organizationRepository.findOne({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new NotFoundException({
        error_code: ERROR_CODES.ORG_NOT_FOUND,
        message: 'Organization not found.',
      });
    }

    const plan = await planRepository.findOne({
      where: { code: dto.plan.toUpperCase(), isActive: true },
    });
    if (!plan) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Active plan not found.',
      });
    }

    const before = this.toWorkspaceDto(workspace);
    workspace.name = dto.name;
    workspace.organization = organization;
    workspace.plan = plan.code as WorkspaceEntity['plan'];

    await workspaceRepository.save(workspace);
    const reloaded = await workspaceRepository.findOneOrFail({
      where: { id: workspaceId },
      relations: { organization: true, planConfig: true },
    });
    const after = this.toWorkspaceDto(reloaded);
    await this.writeAuditLog(
      actorUserId,
      'admin.workspace.update',
      'workspace',
      workspaceId,
      {
        before: this.toAuditPayload(before),
        after: this.toAuditPayload(after),
      },
    );

    return after;
  }

  private async findAdminUserOrThrow(userId: string): Promise<AdminUserEntity> {
    const adminUser = await this.dataSource
      .getRepository(AdminUserEntity)
      .findOne({
        where: { user: { id: userId }, isActive: true },
        relations: { user: true },
      });

    if (!adminUser) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Admin user not found.',
      });
    }

    return adminUser;
  }

  private assertSuperAdmin(role: AdminRole) {
    if (role !== ADMIN_ROLES.SUPER_ADMIN) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Super admin permission is required.',
      });
    }
  }

  private async writeAuditLog(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    changes: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ) {
    await this.dataSource.getRepository(AdminAuditLogEntity).save({
      actorUserId,
      action,
      targetType,
      targetId,
      before: changes.before,
      after: changes.after,
    });
  }

  private toAuditPayload(value: object): Record<string, unknown> {
    return { ...value };
  }

  private toAdminMe(adminUser: AdminUserEntity): AdminMeDto {
    return {
      userId: adminUser.user.id,
      email: adminUser.user.email,
      name: adminUser.user.name,
      role: adminUser.role,
    };
  }

  private toPlanDto(plan: WorkspacePlanEntity): AdminPlanDto {
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

  private toUserDto(user: UserEntity): AdminUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private toOrganizationDto(
    organization: OrganizationEntity,
  ): AdminOrganizationDto {
    return {
      id: organization.id,
      name: organization.name,
      useSso: organization.useSso,
      forceSSO: organization.forceSSO,
      oidcIssuer: organization.oidcIssuer,
      oidcClientId: organization.oidcClientId,
      memberCount: organization.users?.length ?? 0,
      workspaceCount: organization.workspaces?.length ?? 0,
    };
  }

  private toOrganizationSearchItemDto(
    organization: OrganizationEntity,
  ): AdminOrganizationSearchItemDto {
    return {
      ...this.toOrganizationDto(organization),
      workspaces: (organization.workspaces ?? []).map((workspace) =>
        this.toWorkspaceDto(workspace, organization),
      ),
    };
  }

  private toWorkspaceDto(
    workspace: WorkspaceEntity,
    organization = workspace.organization,
  ): AdminWorkspaceDto {
    return {
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      planConfig: workspace.planConfig
        ? this.toPlanDto(workspace.planConfig)
        : undefined,
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
