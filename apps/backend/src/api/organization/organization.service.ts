import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationDomainEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  UserEntity,
} from '@repo/database';
import { DataSource } from 'typeorm';
import {
  ERROR_CODES,
  USER_PERMISSIONS,
  type UserPermissions,
} from '@repo/constants';
import type {
  AddOrganizationMemberDto,
  CreateOrganizationDto,
  OrganizationDetailDto,
  OrganizationMemberDto,
  OrganizationSsoSettingsDto,
  OrganizationSummaryDto,
  SuccessResponseDto,
  UpdateOrganizationDto,
  UpdateOrganizationMemberRoleDto,
  UpdateOrganizationSsoSettingsDto,
} from '@repo/dto';

const organizationManagers: UserPermissions[] = [
  USER_PERMISSIONS.OWNER,
  USER_PERMISSIONS.ADMIN,
];

@Injectable()
export class OrganizationService {
  constructor(private readonly dataSource: DataSource) {}

  async listOrganizations(userId: string): Promise<OrganizationSummaryDto[]> {
    const memberships = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .find({
        where: { user: { id: userId } },
        relations: {
          organization: {
            workspaces: true,
          },
        },
        order: { joinedAt: 'ASC' },
      });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      workspaceCount: membership.organization.workspaces?.length ?? 0,
    }));
  }

  async createOrganization(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationDetailDto> {
    return await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(UserEntity).findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException({
          error_code: ERROR_CODES.INVALID_INPUT,
          message: 'User not found.',
        });
      }

      const organization = manager.getRepository(OrganizationEntity).create({
        name: dto.name,
      });
      await manager.getRepository(OrganizationEntity).save(organization);

      const membership = manager.getRepository(OrganizationUserEntity).create({
        organization,
        user,
        role: USER_PERMISSIONS.OWNER,
        joinedAt: new Date(),
      });
      await manager.getRepository(OrganizationUserEntity).save(membership);

      return {
        id: organization.id,
        name: organization.name,
        role: USER_PERMISSIONS.OWNER,
        members: [
          {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: USER_PERMISSIONS.OWNER,
            joinedAt: membership.joinedAt.toISOString(),
          },
        ],
        workspaces: [],
      };
    });
  }

  async getOrganization(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationDetailDto> {
    const membership = await this.assertOrganizationAccess(
      organizationId,
      userId,
    );
    const organization = await this.findOrganizationOrThrow(organizationId);

    return this.toOrganizationDetail(organization, membership.role);
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationDetailDto> {
    const membership = await this.assertOrganizationAccess(
      organizationId,
      userId,
      organizationManagers,
    );
    const organization = await this.findOrganizationOrThrow(organizationId);

    if (dto.name !== undefined) organization.name = dto.name;
    await this.dataSource.getRepository(OrganizationEntity).save(organization);

    return this.toOrganizationDetail(organization, membership.role);
  }

  async deleteOrganization(
    organizationId: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    await this.assertOrganizationAccess(organizationId, userId, [
      USER_PERMISSIONS.OWNER,
    ]);

    const organization = await this.findOrganizationOrThrow(organizationId);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from(OrganizationDomainEntity)
        .where('"organizationId" = :organizationId', { organizationId })
        .execute();
      await manager
        .createQueryBuilder()
        .delete()
        .from(OrganizationUserEntity)
        .where('"organizationId" = :organizationId', { organizationId })
        .execute();
      await manager.getRepository(OrganizationEntity).remove(organization);
    });

    return { success: true };
  }

  async listMembers(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberDto[]> {
    await this.assertOrganizationAccess(organizationId, userId);
    const organization = await this.findOrganizationOrThrow(organizationId);
    return this.toMembers(organization.users ?? []);
  }

  async addMember(
    organizationId: string,
    userId: string,
    dto: AddOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    await this.assertOrganizationAccess(
      organizationId,
      userId,
      organizationManagers,
    );

    return await this.dataSource.transaction(async (manager) => {
      const organization = await manager
        .getRepository(OrganizationEntity)
        .findOne({ where: { id: organizationId } });
      if (!organization) {
        throw this.organizationNotFound();
      }

      const user = await manager.getRepository(UserEntity).findOne({
        where: { email: dto.email },
      });
      if (!user) {
        throw new NotFoundException({
          error_code: ERROR_CODES.INVALID_INPUT,
          message: 'User not found.',
        });
      }

      const membershipRepository = manager.getRepository(OrganizationUserEntity);
      const existing = await membershipRepository.findOne({
        where: {
          organization: { id: organizationId },
          user: { id: user.id },
        },
      });
      if (existing) {
        throw new BadRequestException({
          error_code: ERROR_CODES.INVALID_INPUT,
          message: 'User is already a member of this organization.',
        });
      }

      const membership = membershipRepository.create({
        organization,
        user,
        role: dto.role ?? USER_PERMISSIONS.MEMBER,
        joinedAt: new Date(),
      });
      await membershipRepository.save(membership);

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: membership.role,
        joinedAt: membership.joinedAt.toISOString(),
      };
    });
  }

  async updateMemberRole(
    organizationId: string,
    targetUserId: string,
    userId: string,
    dto: UpdateOrganizationMemberRoleDto,
  ): Promise<OrganizationMemberDto> {
    await this.assertOrganizationAccess(organizationId, userId, [
      USER_PERMISSIONS.OWNER,
    ]);

    const membership = await this.findMembershipOrThrow(
      organizationId,
      targetUserId,
    );
    await this.assertOwnerInvariant(organizationId, targetUserId, dto.role);

    membership.role = dto.role;
    await this.dataSource.getRepository(OrganizationUserEntity).save(membership);

    return this.toMember(membership);
  }

  async removeMember(
    organizationId: string,
    targetUserId: string,
    userId: string,
  ): Promise<SuccessResponseDto> {
    const requester = await this.assertOrganizationAccess(
      organizationId,
      userId,
      organizationManagers,
    );
    const target = await this.findMembershipOrThrow(
      organizationId,
      targetUserId,
    );

    if (target.role === USER_PERMISSIONS.OWNER) {
      await this.assertOrganizationAccess(organizationId, userId, [
        USER_PERMISSIONS.OWNER,
      ]);
      await this.assertOwnerInvariant(organizationId, targetUserId);
    }

    if (
      requester.role === USER_PERMISSIONS.ADMIN &&
      target.role === USER_PERMISSIONS.ADMIN
    ) {
      throw new ForbiddenException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Admins cannot remove other admins.',
      });
    }

    await this.dataSource.getRepository(OrganizationUserEntity).remove(target);
    return { success: true };
  }

  async getSsoSettings(
    orgId: string,
    userId: string,
  ): Promise<OrganizationSsoSettingsDto> {
    await this.assertOrganizationAccess(orgId, userId);

    const org = await this.findOrganizationOrThrow(orgId);
    return {
      useSso: org.useSso,
      forceSSO: org.forceSSO,
      oidcClientId: org.oidcClientId,
      oidcClientSecret: org.oidcClientSecret ? '[CONFIGURED]' : undefined,
      oidcIssuer: org.oidcIssuer,
      samlEntryPoint: org.samlEntryPoint,
      samlIssuer: org.samlIssuer,
      samlCert: org.samlCert ? '[CONFIGURED]' : undefined,
    };
  }

  async updateSsoSettings(
    orgId: string,
    userId: string,
    settings: UpdateOrganizationSsoSettingsDto,
  ): Promise<SuccessResponseDto> {
    await this.assertOrganizationAccess(orgId, userId, organizationManagers);

    const org = await this.findOrganizationOrThrow(orgId);

    if (settings.useSso !== undefined) org.useSso = settings.useSso;
    if (settings.forceSSO !== undefined) org.forceSSO = settings.forceSSO;
    if (settings.oidcClientId !== undefined)
      org.oidcClientId = settings.oidcClientId;
    if (settings.oidcClientSecret !== undefined)
      org.oidcClientSecret = settings.oidcClientSecret;
    if (settings.oidcIssuer !== undefined) org.oidcIssuer = settings.oidcIssuer;
    if (settings.samlEntryPoint !== undefined)
      org.samlEntryPoint = settings.samlEntryPoint;
    if (settings.samlIssuer !== undefined) org.samlIssuer = settings.samlIssuer;
    if (settings.samlCert !== undefined) org.samlCert = settings.samlCert;

    await this.dataSource.getRepository(OrganizationEntity).save(org);
    return { success: true };
  }

  async assertOrganizationAccess(
    orgId: string,
    userId: string,
    allowedRoles?: UserPermissions[],
  ): Promise<OrganizationUserEntity> {
    const membership = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .findOne({
        where: { organization: { id: orgId }, user: { id: userId } },
        relations: { organization: true, user: true },
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
        message: 'You do not have permission to manage this organization.',
      });
    }

    return membership;
  }

  private async findOrganizationOrThrow(
    organizationId: string,
  ): Promise<OrganizationEntity> {
    const organization = await this.dataSource
      .getRepository(OrganizationEntity)
      .findOne({
        where: { id: organizationId },
        relations: {
          users: {
            user: true,
          },
          workspaces: true,
        },
      });

    if (!organization) {
      throw this.organizationNotFound();
    }

    return organization;
  }

  private async findMembershipOrThrow(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationUserEntity> {
    const membership = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .findOne({
        where: { organization: { id: organizationId }, user: { id: userId } },
        relations: { organization: true, user: true },
      });

    if (!membership) {
      throw new NotFoundException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Organization member not found.',
      });
    }

    return membership;
  }

  private async assertOwnerInvariant(
    organizationId: string,
    targetUserId: string,
    nextRole?: UserPermissions,
  ): Promise<void> {
    const ownerCount = await this.dataSource
      .getRepository(OrganizationUserEntity)
      .count({
        where: {
          organization: { id: organizationId },
          role: USER_PERMISSIONS.OWNER,
        },
      });

    const target = await this.findMembershipOrThrow(
      organizationId,
      targetUserId,
    );

    if (
      target.role === USER_PERMISSIONS.OWNER &&
      ownerCount <= 1 &&
      nextRole !== USER_PERMISSIONS.OWNER
    ) {
      throw new BadRequestException({
        error_code: ERROR_CODES.INVALID_INPUT,
        message: 'Organization must keep at least one owner.',
      });
    }
  }

  private toOrganizationDetail(
    organization: OrganizationEntity,
    role: UserPermissions,
  ): OrganizationDetailDto {
    return {
      id: organization.id,
      name: organization.name,
      role,
      members: this.toMembers(organization.users ?? []),
      workspaces: (organization.workspaces ?? []).map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
      })),
    };
  }

  private toMembers(
    memberships: OrganizationUserEntity[],
  ): OrganizationMemberDto[] {
    return memberships.map((membership) => this.toMember(membership));
  }

  private toMember(membership: OrganizationUserEntity): OrganizationMemberDto {
    return {
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.joinedAt.toISOString(),
    };
  }

  private organizationNotFound() {
    return new NotFoundException({
      error_code: ERROR_CODES.ORG_NOT_FOUND,
      message: 'Organization not found.',
    });
  }
}
