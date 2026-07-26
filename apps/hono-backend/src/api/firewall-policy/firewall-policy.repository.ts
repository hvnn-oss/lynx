import {
  FirewallPolicyEntity,
  FirewallPolicyRevisionEntity,
} from "@repo/database";
import type {
  CreateFirewallPolicyDto,
  UpdateFirewallPolicyDto,
} from "@repo/dto";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/** 방화벽 정책 초안과 불변 배포 리비전을 저장합니다. */
export class FirewallPolicyRepository {
  /** 삭제되지 않은 워크스페이스 정책을 최신 수정 순으로 조회합니다. */
  list(workspaceId: string) {
    return AppDataSource.getRepository(FirewallPolicyEntity)
      .createQueryBuilder("policy")
      .innerJoin("policy.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .andWhere("policy.deletedAt IS NULL")
      .orderBy("policy.updatedAt", "DESC")
      .addOrderBy("policy.id", "DESC")
      .getMany();
  }

  /** 워크스페이스 경계를 적용해 정책 한 개를 조회합니다. */
  find(workspaceId: string, policyId: number) {
    return AppDataSource.getRepository(FirewallPolicyEntity)
      .createQueryBuilder("policy")
      .innerJoin("policy.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .andWhere("policy.id = :policyId", { policyId })
      .andWhere("policy.deletedAt IS NULL")
      .getOne();
  }

  /** 새 정책 초안을 첫 번째 리비전으로 생성합니다. */
  create(workspaceId: string, body: CreateFirewallPolicyDto) {
    const repository = AppDataSource.getRepository(FirewallPolicyEntity);
    const now = new Date();
    return repository.save(
      repository.create({
        ...body,
        description: body.description ?? null,
        webhookUrl: body.webhookUrl ?? null,
        activated: false,
        draftRevision: 1,
        deployedRevision: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        workspace: { id: workspaceId },
      }),
    );
  }

  /** 배포본을 건드리지 않고 정책 초안과 리비전 번호를 갱신합니다. */
  async update(policy: FirewallPolicyEntity, body: UpdateFirewallPolicyDto) {
    Object.assign(policy, body, {
      draftRevision: policy.draftRevision + 1,
      updatedAt: new Date(),
    });
    return AppDataSource.getRepository(FirewallPolicyEntity).save(policy);
  }

  /** 현재 초안을 불변 배포 리비전으로 저장하고 활성화합니다. */
  deploy(policy: FirewallPolicyEntity) {
    return AppDataSource.transaction(async (manager) => {
      const revisions = manager.getRepository(FirewallPolicyRevisionEntity);
      let revision = await revisions.findOneBy({
        policyId: String(policy.id),
        revision: policy.draftRevision,
      });
      if (!revision) {
        revision = await revisions.save(
          revisions.create({
            policyId: String(policy.id),
            revision: policy.draftRevision,
            version: policy.version,
            name: policy.name,
            description: policy.description ?? null,
            condition: policy.condition,
            severity: policy.severity,
            action: policy.action,
            webhookUrl: policy.webhookUrl,
            deployedAt: new Date(),
          }),
        );
      } else if (!revision.deployedAt) {
        revision.deployedAt = new Date();
        await revisions.save(revision);
      }
      policy.deployedRevision = revision.revision;
      policy.activated = true;
      policy.updatedAt = new Date();
      return manager.getRepository(FirewallPolicyEntity).save(policy);
    });
  }

  /** 과거 배포 리비전을 조회합니다. */
  findRevision(policyId: number, revision: number) {
    return AppDataSource.getRepository(FirewallPolicyRevisionEntity).findOneBy(
      {
        policyId: String(policyId),
        revision,
      },
    );
  }

  /** 과거 리비전을 현재 배포본으로 지정합니다. */
  async rollback(
    policy: FirewallPolicyEntity,
    revision: FirewallPolicyRevisionEntity,
  ) {
    policy.deployedRevision = revision.revision;
    policy.activated = true;
    policy.updatedAt = new Date();
    revision.deployedAt = new Date();
    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(FirewallPolicyRevisionEntity).save(revision);
      await manager.getRepository(FirewallPolicyEntity).save(policy);
    });
    return policy;
  }

  /** 이미 배포된 정책의 런타임 활성 상태를 변경합니다. */
  async setActivated(policy: FirewallPolicyEntity, activated: boolean) {
    policy.activated = activated;
    policy.updatedAt = new Date();
    return AppDataSource.getRepository(FirewallPolicyEntity).save(policy);
  }

  /** 이력과 참조를 보존하면서 정책을 소프트 삭제합니다. */
  async softDelete(policy: FirewallPolicyEntity) {
    policy.activated = false;
    policy.deletedAt = new Date();
    policy.updatedAt = policy.deletedAt;
    await AppDataSource.getRepository(FirewallPolicyEntity).save(policy);
  }
}

export const firewallPolicyRepository = new FirewallPolicyRepository();
