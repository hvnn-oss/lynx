import {
  OrganizationCreationEventEntity,
  OrganizationEntity,
  OrganizationPlanEntity,
  OrganizationUserEntity,
  UserEntitlementEntity,
  UserEntity,
} from "@repo/database";
import type { UserPermissions } from "@repo/constants";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { CreateOrganizationRecordInput } from "../../common/types/org.js";

/** 조직 생성에 필요한 권한, 사용량, 영속화 작업을 제공합니다. */
export class OrganizationRepository {
  /** 사용자가 멤버로 속한 조직과 조직 내 역할을 조회합니다. */
  async listForUser(userId: string) {
    const memberships = await AppDataSource.getRepository(
      OrganizationUserEntity,
    ).find({
      where: { user: { id: userId } },
      relations: { organization: true },
      order: { joinedAt: "ASC", id: "ASC" },
    });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      profileImageKey: membership.organization.profileImageKey,
      role: membership.role,
    }));
  }

  listMembers(organizationId: string) {
    return AppDataSource.getRepository(OrganizationUserEntity).find({
      where: { organization: { id: organizationId } },
      relations: { user: true },
      order: { joinedAt: "ASC", id: "ASC" },
    });
  }

  /** 요청 사용자가 속한 조직의 프로필과 역할을 조회합니다. */
  async findProfile(
    organizationId: string,
    userId: string,
  ): Promise<{
    organization: OrganizationEntity;
    role: UserPermissions;
  } | null> {
    const membership = await AppDataSource.getRepository(
      OrganizationUserEntity,
    ).findOne({
      where: {
        organization: { id: organizationId },
        user: { id: userId },
      },
      relations: { organization: true },
    });
    if (!membership) return null;

    return {
      organization: membership.organization,
      role: membership.role,
    };
  }

  /** 조직 이름을 변경합니다. */
  async updateProfileName(organizationId: string, name: string): Promise<void> {
    await AppDataSource.getRepository(OrganizationEntity).update(
      { id: organizationId },
      { name },
    );
  }

  /** 조직 프로필 이미지 저장소 키를 변경합니다. */
  async updateProfileImageKey(
    organizationId: string,
    profileImageKey: string,
  ): Promise<void> {
    await AppDataSource.getRepository(OrganizationEntity).update(
      { id: organizationId },
      { profileImageKey },
    );
  }

  /**
   * 사용자 권한 행을 잠그고 같은 사용자의 동시 조직 생성을 직렬화합니다.
   * @param manager 현재 조직 생성 트랜잭션의 엔티티 매니저입니다.
   * @param userId 조직을 생성하는 사용자 식별자입니다.
   * @returns 잠긴 사용자 권한이며 없으면 null입니다.
   */
  async getLockedEntitlement(
    manager: EntityManager,
    userId: string,
  ): Promise<UserEntitlementEntity | null> {
    return manager.getRepository(UserEntitlementEntity).findOne({
      where: { userId },
      lock: { mode: "pessimistic_write" },
    });
  }

  /**
   * 사용자가 현재 소유한 조직 수를 조회합니다.
   * @param manager 현재 조직 생성 트랜잭션의 엔티티 매니저입니다.
   * @param userId 소유자 사용자 식별자입니다.
   * @returns 활성 소유 조직 수입니다.
   */
  async countOwnedOrganizations(
    manager: EntityManager,
    userId: string,
  ): Promise<number> {
    return manager.getRepository(OrganizationEntity).countBy({
      ownerUserId: userId,
    });
  }

  /**
   * 지정 시각 이후 사용자가 생성한 조직 수를 조회합니다.
   * @param manager 현재 조직 생성 트랜잭션의 엔티티 매니저입니다.
   * @param userId 조직을 생성한 사용자 식별자입니다.
   * @param dayStartedAt 일일 집계를 시작할 UTC 시각입니다.
   * @returns 해당 기간의 조직 생성 횟수입니다.
   */
  async countDailyCreations(
    manager: EntityManager,
    userId: string,
    dayStartedAt: Date,
  ): Promise<number> {
    return manager
      .getRepository(OrganizationCreationEventEntity)
      .createQueryBuilder("event")
      .where('event."userId" = :userId', { userId })
      .andWhere('event."createdAt" >= :dayStartedAt', { dayStartedAt })
      .getCount();
  }

  /**
   * 동일 요청으로 이미 생성된 조직을 조회합니다.
   * @param manager 현재 조직 생성 트랜잭션의 엔티티 매니저입니다.
   * @param requestId 멱등성 판단에 사용할 요청 식별자입니다.
   * @returns 기존 조직이며 없거나 삭제되었으면 null입니다.
   */
  async findByRequestId(
    manager: EntityManager,
    requestId: string,
  ): Promise<OrganizationEntity | null> {
    const event = await manager
      .getRepository(OrganizationCreationEventEntity)
      .findOne({
        where: { requestId },
        relations: { organization: true },
      });
    return event?.organization ?? null;
  }

  /**
   * 조직, OWNER 멤버십, 생성 이력을 현재 트랜잭션에 저장합니다.
   * @param manager 현재 조직 생성 트랜잭션의 엔티티 매니저입니다.
   * @param input 저장할 조직 생성 정보입니다.
   * @returns 저장된 조직입니다.
   */
  async createRecords(
    manager: EntityManager,
    input: CreateOrganizationRecordInput,
  ): Promise<OrganizationEntity> {
    const user = await manager.getRepository(UserEntity).findOneBy({
      id: input.userId,
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const plan = await manager
      .getRepository(OrganizationPlanEntity)
      .findOneBy({ code: "FREE" });
    if (!plan) throw new Error("DEFAULT_ORGANIZATION_PLAN_NOT_FOUND");

    const organizationRepository = manager.getRepository(OrganizationEntity);
    const organization = organizationRepository.create({
      name: input.name,
      planId: plan.id,
      plan,
      ownerUserId: user.id,
      createdByUserId: user.id,
      owner: user,
      createdBy: user,
    });
    await organizationRepository.save(organization);

    const membership = manager.getRepository(OrganizationUserEntity).create({
      organization,
      user,
      role: "OWNER",
      joinedAt: new Date(),
    });
    await manager.getRepository(OrganizationUserEntity).save(membership);

    const event = manager
      .getRepository(OrganizationCreationEventEntity)
      .create({
        userId: user.id,
        user,
        organizationId: organization.id,
        organization,
        requestId: input.requestId,
        source: input.source,
      });
    await manager.getRepository(OrganizationCreationEventEntity).save(event);

    return organization;
  }

  /**
   * 조직 생성 작업을 새 데이터베이스 트랜잭션에서 실행합니다.
   * @param work 트랜잭션 엔티티 매니저를 사용하는 작업입니다.
   * @returns 트랜잭션 작업의 결과입니다.
   */
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return AppDataSource.transaction(work);
  }
}

/** 애플리케이션에서 공유하는 조직 저장소입니다. */
export const orgRepository = new OrganizationRepository();
