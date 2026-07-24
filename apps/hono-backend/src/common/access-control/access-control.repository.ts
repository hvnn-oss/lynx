import {
  AppDataSource,
  OrganizationUserEntity,
  WorkspaceEntity,
  WorkspaceMembershipEntity,
} from "@repo/database";
import type { UserPermissions } from "@repo/constants";
import type { WorkspaceAccess } from "../types/access-control.js";

/** 조직 및 워크스페이스 멤버십 조회를 한곳에서 제공합니다. */
export class AccessControlRepository {
  /** 사용자의 조직 역할을 조회합니다. */
  async findOrganizationRole(
    userId: string,
    organizationId: string,
  ): Promise<UserPermissions | null> {
    const membership = await AppDataSource.getRepository(
      OrganizationUserEntity,
    ).findOne({
      where: {
        organization: { id: organizationId },
        user: { id: userId },
      },
    });
    return membership?.role ?? null;
  }

  /** 조직 역할과 선택적인 워크스페이스 역할을 함께 조회합니다. */
  async findWorkspaceAccess(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceAccess | null> {
    const workspace = await AppDataSource.getRepository(
      WorkspaceEntity,
    ).findOne({
      where: { id: workspaceId },
      relations: { organization: true },
    });
    if (!workspace) return null;

    const [organizationMembership, workspaceMembership] = await Promise.all([
      AppDataSource.getRepository(OrganizationUserEntity).findOne({
        where: {
          organization: { id: workspace.organization.id },
          user: { id: userId },
        },
      }),
      AppDataSource.getRepository(WorkspaceMembershipEntity).findOne({
        where: { workspaceId, userId },
      }),
    ]);
    if (!organizationMembership) return null;

    return {
      organizationId: workspace.organization.id,
      organizationRole: organizationMembership.role,
      workspaceRole: workspaceMembership?.role ?? null,
    };
  }
}

/** 애플리케이션에서 공유하는 접근 권한 저장소입니다. */
export const accessControlRepository = new AccessControlRepository();
