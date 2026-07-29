import {
  AgentEntity,
  FirewallPolicyEntity,
  FirewallPolicyRevisionEntity,
  FirewallViolationEntity,
} from "@repo/database";
import { randomUUID } from "node:crypto";
import type {
  CreateFirewallPolicyDto,
  FirewallRecordListQueryDto,
  UpdateFirewallPolicyDto,
  WebhookDeliveryListQueryDto,
} from "@repo/dto";
import { Brackets } from "typeorm";
import { firewallNotificationService } from "../../common/services/firewall-notification.service.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { webhookDeliveryRepository } from "../../provider/webhook/webhook-delivery.repository.js";

export interface FirewallPolicyViolationStats {
  lastMatchedAt: Date | null;
  recentBlockCount: number;
}

export type UpdateFirewallPolicyResult =
  | { status: "updated"; policy: FirewallPolicyEntity }
  | { status: "conflict"; currentDraftRevision: number }
  | { status: "not-found" };

/** 방화벽 정책 초안, 배포 리비전, 운영 기록을 저장하고 조회합니다. */
export class FirewallPolicyRepository {
  /** 삭제되지 않은 워크스페이스 정책을 최근 수정 순으로 조회합니다. */
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

  /** 정책 적용 대상을 선택할 수 있도록 Agent 식별 정보를 조회합니다. */
  listTargetAgents(workspaceId: string) {
    return AppDataSource.getRepository(AgentEntity)
      .createQueryBuilder("agent")
      .innerJoin("agent.workspace", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .select(["agent.id", "agent.name", "agent.clientAgentId"])
      .orderBy("agent.name", "ASC")
      .addOrderBy("agent.id", "ASC")
      .take(100)
      .getMany();
  }

  /** 정책 Webhook의 전송 이력을 Outbox에서 조회합니다. */
  listWebhookDeliveries(
    workspaceId: string,
    policyId: number,
    query: WebhookDeliveryListQueryDto,
  ) {
    return webhookDeliveryRepository.list({
      workspaceId,
      policyId: String(policyId),
      ...query,
    });
  }

  /** 수동 재시도 전에 정책 경계 안의 전송 레코드를 조회합니다. */
  findWebhookDelivery(
    workspaceId: string,
    policyId: number,
    deliveryId: string,
  ) {
    return webhookDeliveryRepository.find(
      workspaceId,
      String(policyId),
      deliveryId,
    );
  }

  /** 실패하거나 예약된 Webhook을 즉시 재시도 대기열로 되돌립니다. */
  retryWebhookDelivery(
    workspaceId: string,
    policyId: number,
    deliveryId: string,
  ) {
    return webhookDeliveryRepository.retry(
      workspaceId,
      String(policyId),
      deliveryId,
    );
  }

  /** 현재 초안의 목적지로 운영자가 식별할 수 있는 테스트 이벤트를 기록합니다. */
  createWebhookTest(
    workspaceId: string,
    policy: FirewallPolicyEntity,
    destinationUrl: string,
  ) {
    return AppDataSource.transaction((manager) =>
      firewallNotificationService.enqueueDestination(manager, {
        workspaceId,
        policyId: String(policy.id),
        policyRevision: policy.draftRevision,
        destinationUrl,
        type: "webhook.test",
        deduplicationKey: `webhook.test:${randomUUID()}`,
        data: {
          policyId: String(policy.id),
          policyName: policy.name,
          revision: policy.draftRevision,
          message: "Lynx webhook test delivery",
        },
      }),
    );
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

  /** 정책 목록에 표시할 최근 일치 시각과 24시간 차단 수를 집계합니다. */
  async getViolationStats(
    workspaceId: string,
    policyIds: number[],
    since: Date,
  ): Promise<Map<string, FirewallPolicyViolationStats>> {
    if (policyIds.length === 0) return new Map();
    const rows = await AppDataSource.getRepository(FirewallViolationEntity)
      .createQueryBuilder("violation")
      .select('violation."reasonId"', "policyId")
      .addSelect('MAX(violation."createdAt")', "lastMatchedAt")
      .addSelect(
        `COUNT(*) FILTER (
          WHERE violation."createdAt" >= :since
            AND violation.action = 'BLOCK'
        )`,
        "recentBlockCount",
      )
      .where('violation."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('violation."reasonId" IN (:...policyIds)', { policyIds })
      .setParameter("since", since)
      .groupBy('violation."reasonId"')
      .getRawMany<{
        policyId: string;
        lastMatchedAt: Date | string | null;
        recentBlockCount: string;
      }>();

    return new Map(
      rows.map((row) => [
        String(row.policyId),
        {
          lastMatchedAt: row.lastMatchedAt ? new Date(row.lastMatchedAt) : null,
          recentBlockCount: Number(row.recentBlockCount),
        },
      ]),
    );
  }

  /** 새 정책 초안을 첫 번째 리비전 번호로 생성합니다. */
  create(workspaceId: string, body: CreateFirewallPolicyDto) {
    const repository = AppDataSource.getRepository(FirewallPolicyEntity);
    const now = new Date();
    return repository.save(
      repository.create({
        ...body,
        description: body.description ?? null,
        webhookUrl: body.webhookUrl ?? null,
        environments: body.environments ?? [],
        agentIds: body.agentIds ?? [],
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

  /**
   * 기대 리비전과 현재 리비전을 원자적으로 비교한 뒤 초안을 갱신합니다.
   * 다른 편집자가 먼저 저장했으면 기존 값을 덮어쓰지 않습니다.
   */
  updateDraft(
    workspaceId: string,
    policyId: number,
    body: UpdateFirewallPolicyDto,
  ): Promise<UpdateFirewallPolicyResult> {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(FirewallPolicyEntity);
      const policy = await repository
        .createQueryBuilder("policy")
        .setLock("pessimistic_write")
        .innerJoin("policy.workspace", "workspace")
        .where("workspace.id = :workspaceId", { workspaceId })
        .andWhere("policy.id = :policyId", { policyId })
        .andWhere("policy.deletedAt IS NULL")
        .getOne();
      if (!policy) return { status: "not-found" };
      if (policy.draftRevision !== body.expectedDraftRevision) {
        return {
          status: "conflict",
          currentDraftRevision: policy.draftRevision,
        };
      }

      const { expectedDraftRevision: _expectedDraftRevision, ...changes } =
        body;
      Object.assign(policy, changes, {
        draftRevision: policy.draftRevision + 1,
        updatedAt: new Date(),
      });
      return { status: "updated", policy: await repository.save(policy) };
    });
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
            environments: policy.environments,
            agentIds: policy.agentIds,
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
    return AppDataSource.getRepository(FirewallPolicyRevisionEntity).findOneBy({
      policyId: String(policyId),
      revision,
    });
  }

  /** 정책의 불변 배포 리비전을 최신순으로 조회합니다. */
  listRevisions(policyId: number) {
    return AppDataSource.getRepository(FirewallPolicyRevisionEntity).find({
      where: { policyId: String(policyId) },
      order: { revision: "DESC" },
    });
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

  /** 이미 배포된 정책의 활성 상태를 변경합니다. */
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

  /** 정책 판단 기록을 커서 기반으로 조회합니다. */
  async listRecords(workspaceId: string, query: FirewallRecordListQueryDto) {
    const repository = AppDataSource.getRepository(FirewallViolationEntity);
    const builder = repository
      .createQueryBuilder("violation")
      .leftJoinAndSelect("violation.reason", "policy")
      .leftJoinAndSelect("violation.agent", "agent")
      .leftJoinAndSelect("violation.session", "session")
      .leftJoinAndSelect("violation.event", "event")
      .leftJoinAndSelect("event.run", "run")
      .where('violation."workspaceId" = :workspaceId', { workspaceId });

    if (query.action) {
      builder.andWhere("violation.action = :action", { action: query.action });
    }
    if (query.severity) {
      builder.andWhere("violation.severity = :severity", {
        severity: query.severity,
      });
    }
    if (query.agentId) {
      builder.andWhere("agent.id = :agentId", { agentId: query.agentId });
    }
    if (query.toolName) {
      builder.andWhere("violation.toolName = :toolName", {
        toolName: query.toolName,
      });
    }
    if (query.cursor) {
      const cursor = await repository.findOne({
        where: { id: query.cursor, workspaceId },
        select: { id: true, createdAt: true },
      });
      if (cursor) {
        builder.andWhere(
          new Brackets((where) => {
            where
              .where("violation.createdAt < :cursorCreatedAt", {
                cursorCreatedAt: cursor.createdAt,
              })
              .orWhere(
                "violation.createdAt = :cursorCreatedAt AND violation.id < :cursorId",
                {
                  cursorCreatedAt: cursor.createdAt,
                  cursorId: cursor.id,
                },
              );
          }),
        );
      }
    }

    return builder
      .orderBy("violation.createdAt", "DESC")
      .addOrderBy("violation.id", "DESC")
      .take(query.limit + 1)
      .getMany();
  }
}

export const firewallPolicyRepository = new FirewallPolicyRepository();
