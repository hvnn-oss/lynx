import { ERROR_CODES } from "@repo/constants";
import {
  OrganizationEntity,
  OrganizationUserEntity,
  WorkspaceApiKeyEntity,
  WorkspaceEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { ForbiddenErrorException } from "../../common/exceptions/forbidden.js";
import type {
  CreateWorkspaceApiKeyRecordInput,
  CreateWorkspaceRecordInput,
} from "../../common/types/workspace.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

export type WorkspaceListItem = {
  id: string;
  name: string;
  orgId: string;
};

/** 워크스페이스 생성에 필요한 권한, 한도, 영속화 작업을 제공합니다. */
export class WorkspaceRepository {
  /** Lists workspaces available through the user's organization memberships. */
  async listForUser(userId: string): Promise<WorkspaceListItem[]> {
    const rows = await AppDataSource.getRepository(OrganizationUserEntity)
      .createQueryBuilder("membership")
      .innerJoin("membership.user", "user")
      .innerJoin("membership.organization", "organization")
      .innerJoin("organization.workspaces", "workspace")
      .select("workspace.id", "workspace_id")
      .addSelect("workspace.name", "workspace_name")
      .addSelect("organization.id", "organization_id")
      .where("user.id = :userId", { userId })
      .orderBy("workspace.name", "ASC")
      .addOrderBy("workspace.id", "ASC")
      .getRawMany<{
        workspace_id: string;
        workspace_name: string;
        organization_id: string;
      }>();

    return rows.map((row) => ({
      id: row.workspace_id,
      name: row.workspace_name,
      orgId: row.organization_id,
    }));
  }

  /**
   * 조직 행을 잠근 뒤 요금제 한도를 확인하고 워크스페이스를 저장합니다.
   * @param input 검증된 워크스페이스 생성 정보입니다.
   * @returns 저장된 워크스페이스입니다.
   */
  createWorkspace(input: CreateWorkspaceRecordInput): Promise<WorkspaceEntity> {
    return AppDataSource.transaction(async (manager) => {
      const organization = await this.getLockedOrganization(
        manager,
        input.orgId,
      );
      const workspaceCount = await manager
        .getRepository(WorkspaceEntity)
        .countBy({ organization: { id: input.orgId } });
      if (
        organization.plan.maxWorkspaces !== null &&
        workspaceCount >= organization.plan.maxWorkspaces
      ) {
        throw new ForbiddenErrorException(ERROR_CODES.PLAN_UPGRADE_REQUIRED);
      }

      const workspaceRepository = manager.getRepository(WorkspaceEntity);
      const workspace = workspaceRepository.create({
        name: input.name,
        organization,
      });
      return workspaceRepository.save(workspace);
    });
  }

  /** 검증된 API Key 메타데이터와 secret 해시를 저장합니다. */
  async createApiKey(
    input: CreateWorkspaceApiKeyRecordInput,
  ): Promise<WorkspaceApiKeyEntity> {
    return AppDataSource.transaction(async (manager) => {
      const workspace = await this.getLockedWorkspace(
        manager,
        input.workspaceId,
      );
      const apiKeyRepository = manager.getRepository(WorkspaceApiKeyEntity);
      const apiKey = apiKeyRepository.create({
        id: input.id,
        workspaceId: input.workspaceId,
        keyHash: input.keyHash,
        name: input.name,
        createdByUserId: input.userId,
        expiresAt: input.expiresAt ?? undefined,
        kind: input.kind,
        prefix: input.prefix,
        scopes: input.scopes,
        workspace,
      });
      return apiKeyRepository.save(apiKey);
    });
  }

  listApiKeys(workspaceId: string): Promise<WorkspaceApiKeyEntity[]> {
    return AppDataSource.getRepository(WorkspaceApiKeyEntity).find({
      where: { workspaceId },
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  async revokeApiKey(workspaceId: string, apiKeyId: string): Promise<boolean> {
    const result = await AppDataSource.getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where("id = :apiKeyId", { apiKeyId })
      .andWhere('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere('"revokedAt" IS NULL')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async deleteRevokedApiKey(
    workspaceId: string,
    apiKeyId: string,
  ): Promise<boolean> {
    const result = await AppDataSource.getRepository(WorkspaceApiKeyEntity)
      .createQueryBuilder()
      .delete()
      .where("id = :apiKeyId", { apiKeyId })
      .andWhere('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere('"revokedAt" IS NOT NULL')
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** 조직을 잠그고 요금제 정보와 함께 조회합니다. */
  private async getLockedOrganization(
    manager: EntityManager,
    orgId: string,
  ): Promise<OrganizationEntity> {
    const organization = await manager
      .getRepository(OrganizationEntity)
      .findOne({
        where: { id: orgId },
        relations: { plan: true },
        lock: { mode: "pessimistic_write" },
      });
    if (!organization)
      throw new ForbiddenErrorException(ERROR_CODES.INVALID_ORG);

    return organization;
  }

  /** 워크스페이스를 잠그고 조회합니다. */
  private async getLockedWorkspace(
    manager: EntityManager,
    workspaceId: string,
  ): Promise<WorkspaceEntity> {
    const workspace = await manager.getRepository(WorkspaceEntity).findOne({
      where: { id: workspaceId },
      lock: { mode: "pessimistic_write" },
    });
    if (!workspace)
      throw new ForbiddenErrorException(ERROR_CODES.INVALID_WORKSPACE);

    return workspace;
  }
}

/** 애플리케이션에서 공유하는 워크스페이스 저장소입니다. */
export const workspaceRepository = new WorkspaceRepository();
