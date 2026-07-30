import {
  ACCESS_INVITATION_STATUS,
  ACCESS_INVITATION_TARGET_TYPE,
  type AccessInvitationStatus,
  type UserPermissions,
} from "@repo/constants";
import {
  AccessInvitationEntity,
  OrganizationEntity,
  OrganizationPlanEntity,
  OrganizationUserEntity,
  UserEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

interface CreateInvitationRecord {
  email: string;
  tokenHash: string;
  invitedByUserId: string;
  expiresAt: Date;
  organizationPlanId: string;
}

interface CreateOrganizationInvitationRecord
  extends Omit<CreateInvitationRecord, "organizationPlanId"> {
  organizationId: string;
  role: UserPermissions;
}

interface InvitationCursor {
  createdAt: Date;
  id: string;
}

/** 제품 파일럿과 조직 초대의 생성, 조회, 수락 상태 전이를 저장합니다. */
export class AccessInvitationRepository {
  /** 같은 이메일의 기존 대기 초대를 폐기하고 새 초대를 저장합니다. */
  create(input: CreateInvitationRecord): Promise<AccessInvitationEntity> {
    return AppDataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        input.email,
      ]);
      await manager
        .getRepository(AccessInvitationEntity)
        .createQueryBuilder()
        .update()
        .set({ status: ACCESS_INVITATION_STATUS.REVOKED })
        .where("LOWER(email) = LOWER(:email)", { email: input.email })
        .andWhere("status = :status", {
          status: ACCESS_INVITATION_STATUS.PENDING,
        })
        .andWhere('"targetType" = :targetType', {
          targetType: ACCESS_INVITATION_TARGET_TYPE.PRODUCT,
        })
        .execute();

      return manager.getRepository(AccessInvitationEntity).save(
        manager.getRepository(AccessInvitationEntity).create({
          ...input,
          targetType: ACCESS_INVITATION_TARGET_TYPE.PRODUCT,
          targetId: null,
          role: null,
          organizationPlanId: input.organizationPlanId,
          status: ACCESS_INVITATION_STATUS.PENDING,
          acceptedByUserId: null,
          acceptedAt: null,
        }),
      );
    });
  }

  /** 같은 조직과 이메일의 기존 대기 초대를 교체하고 팀 초대를 저장합니다. */
  createOrganization(
    input: CreateOrganizationInvitationRecord,
  ): Promise<AccessInvitationEntity> {
    return AppDataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${input.organizationId}:${input.email}`,
      ]);
      await manager
        .getRepository(AccessInvitationEntity)
        .createQueryBuilder()
        .update()
        .set({ status: ACCESS_INVITATION_STATUS.REVOKED })
        .where("LOWER(email) = LOWER(:email)", { email: input.email })
        .andWhere('"targetType" = :targetType', {
          targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
        })
        .andWhere('"targetId" = :organizationId', {
          organizationId: input.organizationId,
        })
        .andWhere("status = :status", {
          status: ACCESS_INVITATION_STATUS.PENDING,
        })
        .execute();

      const repository = manager.getRepository(AccessInvitationEntity);
      return repository.save(
        repository.create({
          email: input.email,
          tokenHash: input.tokenHash,
          invitedByUserId: input.invitedByUserId,
          expiresAt: input.expiresAt,
          targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
          targetId: input.organizationId,
          role: input.role,
          organizationPlanId: null,
          status: ACCESS_INVITATION_STATUS.PENDING,
          acceptedByUserId: null,
          acceptedAt: null,
        }),
      );
    });
  }

  /** 해시와 이메일이 모두 일치하는 사용 가능한 초대만 반환합니다. */
  async findPending(
    tokenHash: string,
    email: string,
  ): Promise<AccessInvitationEntity | null> {
    const repository = AppDataSource.getRepository(AccessInvitationEntity);
    const invitation = await repository.findOneBy({
      tokenHash,
      email,
      targetType: ACCESS_INVITATION_TARGET_TYPE.PRODUCT,
      status: ACCESS_INVITATION_STATUS.PENDING,
    });
    if (!invitation) return null;
    if (invitation.expiresAt.getTime() > Date.now()) return invitation;

    await repository.update(
      {
        id: invitation.id,
        status: ACCESS_INVITATION_STATUS.PENDING,
      },
      { status: ACCESS_INVITATION_STATUS.EXPIRED },
    );
    return null;
  }

  /** 코드로 접근한 사용 가능한 조직 초대를 조회합니다. */
  async findPendingOrganization(
    tokenHash: string,
  ): Promise<AccessInvitationEntity | null> {
    const repository = AppDataSource.getRepository(AccessInvitationEntity);
    const invitation = await repository.findOneBy({
      tokenHash,
      targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
      status: ACCESS_INVITATION_STATUS.PENDING,
    });
    if (!invitation) return null;
    if (invitation.expiresAt.getTime() > Date.now()) return invitation;

    await repository.update(
      {
        id: invitation.id,
        status: ACCESS_INVITATION_STATUS.PENDING,
      },
      { status: ACCESS_INVITATION_STATUS.EXPIRED },
    );
    return null;
  }

  /** 조직 설정 화면에 표시할 대기·완료 초대 목록을 조회합니다. */
  async listOrganization(
    organizationId: string,
  ): Promise<AccessInvitationEntity[]> {
    await this.expirePending();
    return AppDataSource.getRepository(AccessInvitationEntity).find({
      where: {
        targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
        targetId: organizationId,
      },
      order: { createdAt: "DESC", id: "DESC" },
      take: 100,
    });
  }

  /** 초대 화면과 수락 응답에 사용할 조직 정보를 조회합니다. */
  findOrganization(organizationId: string): Promise<OrganizationEntity | null> {
    return AppDataSource.getRepository(OrganizationEntity).findOneBy({
      id: organizationId,
    });
  }

  /** 제품 초대에 지정할 수 있는 활성 조직 요금제를 조회합니다. */
  findActiveOrganizationPlan(
    organizationPlanId?: string,
  ): Promise<OrganizationPlanEntity | null> {
    return AppDataSource.getRepository(OrganizationPlanEntity).findOneBy(
      organizationPlanId
        ? { id: organizationPlanId, isActive: true }
        : { code: "FREE", isActive: true },
    );
  }

  /** 이미 조직에 참여한 이메일인지 초대 발급 전에 확인합니다. */
  async isOrganizationMemberEmail(
    organizationId: string,
    email: string,
  ): Promise<boolean> {
    const count = await AppDataSource.getRepository(OrganizationUserEntity)
      .createQueryBuilder("membership")
      .innerJoin("membership.user", "user")
      .innerJoin("membership.organization", "organization")
      .where("organization.id = :organizationId", { organizationId })
      .andWhere("LOWER(user.email) = LOWER(:email)", { email })
      .getCount();
    return count > 0;
  }

  /** 가입 트랜잭션 안에서 초대를 잠그고 일회성 수락으로 변경합니다. */
  async accept(
    manager: EntityManager,
    invitationId: string,
    email: string,
    userId: string,
  ): Promise<AccessInvitationEntity | null> {
    const repository = manager.getRepository(AccessInvitationEntity);
    const invitation = await repository.findOne({
      where: { id: invitationId },
      lock: { mode: "pessimistic_write" },
    });
    if (
      !invitation ||
      invitation.email !== email ||
      invitation.status !== ACCESS_INVITATION_STATUS.PENDING ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }

    invitation.status = ACCESS_INVITATION_STATUS.ACCEPTED;
    invitation.acceptedByUserId = userId;
    invitation.acceptedAt = new Date();
    return repository.save(invitation);
  }

  /** 생성 시각과 ID 복합 cursor를 사용해 초대 목록을 안정적으로 조회합니다. */
  async list(input: {
    status?: AccessInvitationStatus;
    cursor?: InvitationCursor;
    limit: number;
  }): Promise<AccessInvitationEntity[]> {
    await this.expirePending();
    const query = AppDataSource.getRepository(AccessInvitationEntity)
      .createQueryBuilder("invitation")
      .where('invitation."targetType" = :targetType', {
        targetType: ACCESS_INVITATION_TARGET_TYPE.PRODUCT,
      })
      .orderBy("invitation.createdAt", "DESC")
      .addOrderBy("invitation.id", "DESC")
      .take(input.limit + 1);
    if (input.status) {
      query.andWhere("invitation.status = :status", { status: input.status });
    }
    if (input.cursor) {
      query.andWhere(
        `(invitation."createdAt", invitation.id) < (:createdAt, :id)`,
        {
          createdAt: input.cursor.createdAt,
          id: input.cursor.id,
        },
      );
    }
    return query.getMany();
  }

  /** 아직 사용되지 않은 초대만 취소합니다. */
  async revoke(invitationId: string): Promise<boolean> {
    const result = await AppDataSource.getRepository(AccessInvitationEntity)
      .createQueryBuilder()
      .update()
      .set({ status: ACCESS_INVITATION_STATUS.REVOKED })
      .where("id = :invitationId", { invitationId })
      .andWhere('"targetType" = :targetType', {
        targetType: ACCESS_INVITATION_TARGET_TYPE.PRODUCT,
      })
      .andWhere("status = :status", {
        status: ACCESS_INVITATION_STATUS.PENDING,
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** 지정 조직에 속한 사용되지 않은 초대만 취소합니다. */
  async revokeOrganization(
    organizationId: string,
    invitationId: string,
  ): Promise<boolean> {
    const result = await AppDataSource.getRepository(AccessInvitationEntity)
      .createQueryBuilder()
      .update()
      .set({ status: ACCESS_INVITATION_STATUS.REVOKED })
      .where("id = :invitationId", { invitationId })
      .andWhere('"targetType" = :targetType', {
        targetType: ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION,
      })
      .andWhere('"targetId" = :organizationId', { organizationId })
      .andWhere("status = :status", {
        status: ACCESS_INVITATION_STATUS.PENDING,
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** 기존 사용자의 초대 수락을 하나의 DB 트랜잭션으로 실행합니다. */
  transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return AppDataSource.transaction(work);
  }

  /** 초대 수락에 필요한 사용자 계정을 트랜잭션 안에서 조회합니다. */
  findUser(
    manager: EntityManager,
    userId: string,
  ): Promise<UserEntity | null> {
    return manager.getRepository(UserEntity).findOneBy({ id: userId });
  }

  /** 중복 수락에도 조직 멤버십이 하나만 남도록 저장합니다. */
  async addOrganizationMember(
    manager: EntityManager,
    input: {
      organizationId: string;
      user: UserEntity;
      role: UserPermissions;
    },
  ): Promise<void> {
    const repository = manager.getRepository(OrganizationUserEntity);
    const existing = await repository.findOne({
      where: {
        organization: { id: input.organizationId },
        user: { id: input.user.id },
      },
    });
    if (existing) return;

    await repository.save(
      repository.create({
        organization: { id: input.organizationId },
        user: input.user,
        role: input.role,
        joinedAt: new Date(),
      }),
    );
  }

  /** 메일 발송에 실패한 새 초대 레코드를 제거합니다. */
  async deletePending(invitationId: string): Promise<void> {
    await AppDataSource.getRepository(AccessInvitationEntity).delete({
      id: invitationId,
      status: ACCESS_INVITATION_STATUS.PENDING,
    });
  }

  /** 만료 시각이 지난 대기 초대를 목록 조회 전에 정리합니다. */
  private async expirePending(): Promise<void> {
    await AppDataSource.getRepository(AccessInvitationEntity)
      .createQueryBuilder()
      .update()
      .set({ status: ACCESS_INVITATION_STATUS.EXPIRED })
      .where("status = :status", {
        status: ACCESS_INVITATION_STATUS.PENDING,
      })
      .andWhere('"expiresAt" <= :now', { now: new Date() })
      .execute();
  }
}

/** 애플리케이션에서 공유하는 제품·조직 초대 저장소입니다. */
export const accessInvitationRepository = new AccessInvitationRepository();
