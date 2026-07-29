import type {
  CreateFirewallPolicyDto,
  FirewallPolicyResponseDto,
  FirewallPolicyRevisionResponseDto,
  FirewallRecordListQueryDto,
  SimulateFirewallPolicyDto,
  UpdateFirewallPolicyDto,
  WebhookDeliveryListQueryDto,
} from "@repo/dto";
import type {
  FirewallPolicyEntity,
  FirewallPolicyRevisionEntity,
  FirewallViolationEntity,
  WebhookDeliveryEntity,
} from "@repo/database";
import { WEBHOOK_DELIVERY_STATUS } from "@repo/constants";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import { ConflictErrorException } from "../../common/exceptions/conflict.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import { PolicyConditionEvaluator } from "../../common/firewall/policy-condition-evaluator.js";
import { runtimeConfigService } from "../openapi/runtime-config/runtime-config.service.js";
import {
  FirewallPolicyRepository,
  type FirewallPolicyViolationStats,
  firewallPolicyRepository,
} from "./firewall-policy.repository.js";

const RECENT_BLOCK_WINDOW_MS = 24 * 60 * 60 * 1_000;

/** 정책 관리, 배포, 시뮬레이션, 운영 기록 조회 유스케이스를 처리합니다. */
export class FirewallPolicyService {
  constructor(
    private readonly repository: FirewallPolicyRepository = firewallPolicyRepository,
    private readonly accessControl: AccessControlService = accessControlService,
    private readonly evaluator = new PolicyConditionEvaluator(),
  ) {}

  /** 읽기 권한이 있는 사용자의 정책 목록과 운영 상태를 반환합니다. */
  async list(userId: string, workspaceId: string) {
    await this.assertRead(userId, workspaceId);
    const policies = await this.repository.list(workspaceId);
    const stats = await this.repository.getViolationStats(
      workspaceId,
      policies.map((policy) => policy.id),
      new Date(Date.now() - RECENT_BLOCK_WINDOW_MS),
    );
    return {
      items: policies.map((policy) =>
        this.toResponse(policy, stats.get(String(policy.id))),
      ),
    };
  }

  /** 정책 편집 화면에 필요한 현재 초안 상세를 반환합니다. */
  async detail(userId: string, workspaceId: string, policyId: number) {
    await this.assertRead(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const stats = await this.repository.getViolationStats(
      workspaceId,
      [policy.id],
      new Date(Date.now() - RECENT_BLOCK_WINDOW_MS),
    );
    return {
      policy: this.toResponse(policy, stats.get(String(policy.id))),
    };
  }

  /** 정책 적용 범위에서 선택할 수 있는 Agent 목록을 반환합니다. */
  async targetOptions(userId: string, workspaceId: string) {
    await this.assertRead(userId, workspaceId);
    return {
      agents: (await this.repository.listTargetAgents(workspaceId)).map(
        (agent) => ({
          id: agent.id,
          name: agent.name,
          clientAgentId: agent.clientAgentId ?? null,
        }),
      ),
    };
  }

  /** 정책의 불변 배포 리비전 이력을 반환합니다. */
  async revisions(userId: string, workspaceId: string, policyId: number) {
    await this.assertRead(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    return {
      items: (await this.repository.listRevisions(policyId)).map((revision) =>
        this.toRevisionResponse(revision, policy.deployedRevision),
      ),
    };
  }

  /** 검증된 정책 초안을 생성합니다. */
  async create(
    userId: string,
    workspaceId: string,
    body: CreateFirewallPolicyDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    this.validateCondition(body.condition);
    return {
      policy: this.toResponse(await this.repository.create(workspaceId, body)),
    };
  }

  /** 배포본과 분리된 정책 초안을 낙관적 잠금으로 수정합니다. */
  async update(
    userId: string,
    workspaceId: string,
    policyId: number,
    body: UpdateFirewallPolicyDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    if (body.condition) this.validateCondition(body.condition);
    const result = await this.repository.updateDraft(
      workspaceId,
      policyId,
      body,
    );
    if (result.status === "not-found") {
      throw new NotFoundErrorException("POLICY_NOT_FOUND");
    }
    if (result.status === "conflict") {
      throw new ConflictErrorException(
        `POLICY_DRAFT_CONFLICT:${result.currentDraftRevision}`,
      );
    }
    return { policy: this.toResponse(result.policy) };
  }

  /** 현재 초안을 새 불변 리비전으로 배포합니다. */
  async deploy(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const deployed = await this.repository.deploy(policy);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(deployed) };
  }

  /** 이미 배포된 정책을 SDK 평가 대상에 다시 포함합니다. */
  async activate(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    if (policy.deployedRevision === null) {
      throw new BadRequestErrorException("POLICY_NOT_DEPLOYED");
    }
    const activated = await this.repository.setActivated(policy, true);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(activated) };
  }

  /** 정책을 삭제하지 않고 SDK 배포본에서 제외합니다. */
  async deactivate(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const deactivated = await this.repository.setActivated(policy, false);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(deactivated) };
  }

  /** 지정한 과거 리비전을 다시 활성 배포본으로 지정합니다. */
  async rollback(
    userId: string,
    workspaceId: string,
    policyId: number,
    revisionNumber: number,
  ) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const revision = await this.repository.findRevision(
      policyId,
      revisionNumber,
    );
    if (!revision) {
      throw new NotFoundErrorException("POLICY_REVISION_NOT_FOUND");
    }
    const rolledBack = await this.repository.rollback(policy, revision);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(rolledBack) };
  }

  /** 현재 초안을 부작용 없이 평가하고 조건별 일치 근거를 반환합니다. */
  async simulate(
    userId: string,
    workspaceId: string,
    policyId: number,
    body: SimulateFirewallPolicyDto,
  ) {
    await this.assertRead(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const evaluation = this.evaluator.evaluate(policy.condition, body);
    return {
      matched: evaluation.matched,
      conditions: evaluation.conditions,
      action: policy.action,
      severity: policy.severity,
      policyId: String(policy.id),
      version: policy.version,
      revision: policy.draftRevision,
    };
  }

  /** 정책과 위반 이력을 보존하면서 정책을 소프트 삭제합니다. */
  async delete(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    await this.repository.softDelete(policy);
    runtimeConfigService.invalidate(workspaceId);
    return { deleted: true as const };
  }

  /** 정책 판단과 차단 기록을 실행 관계와 함께 반환합니다. */
  async records(
    userId: string,
    workspaceId: string,
    query: FirewallRecordListQueryDto,
  ) {
    await this.assertRead(userId, workspaceId);
    const records = await this.repository.listRecords(workspaceId, query);
    const hasNext = records.length > query.limit;
    const items = records.slice(0, query.limit);
    return {
      items: items.map((record) => this.toRecordResponse(record)),
      nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
    };
  }

  /** 정책별 Webhook 성공·재시도·최종 실패 이력을 조회합니다. */
  async webhookDeliveries(
    userId: string,
    workspaceId: string,
    policyId: number,
    query: WebhookDeliveryListQueryDto,
  ) {
    await this.assertRead(userId, workspaceId);
    await this.findPolicy(workspaceId, policyId);
    const rows = await this.repository.listWebhookDeliveries(
      workspaceId,
      policyId,
      query,
    );
    const hasNext = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items: items.map((delivery) => this.toWebhookDelivery(delivery)),
      nextCursor:
        hasNext && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  /** 현재 초안 URL에 실제 전송 worker를 거치는 테스트 이벤트를 예약합니다. */
  async testWebhook(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    if (!policy.webhookUrl) {
      throw new BadRequestErrorException("WEBHOOK_URL_NOT_CONFIGURED");
    }
    const delivery = await this.repository.createWebhookTest(
      workspaceId,
      policy,
      policy.webhookUrl,
    );
    return { delivery: this.toWebhookDelivery(delivery) };
  }

  /** 운영자가 최종 실패 또는 예약된 전송을 즉시 다시 시도하도록 예약합니다. */
  async retryWebhookDelivery(
    userId: string,
    workspaceId: string,
    policyId: number,
    deliveryId: string,
  ) {
    await this.assertWrite(userId, workspaceId);
    await this.findPolicy(workspaceId, policyId);
    const current = await this.repository.findWebhookDelivery(
      workspaceId,
      policyId,
      deliveryId,
    );
    if (!current) {
      throw new NotFoundErrorException("WEBHOOK_DELIVERY_NOT_FOUND");
    }
    if (
      current.status !== WEBHOOK_DELIVERY_STATUS.FAILED &&
      current.status !== WEBHOOK_DELIVERY_STATUS.RETRY_SCHEDULED
    ) {
      throw new BadRequestErrorException("WEBHOOK_DELIVERY_NOT_RETRYABLE");
    }
    const delivery = await this.repository.retryWebhookDelivery(
      workspaceId,
      policyId,
      deliveryId,
    );
    if (!delivery) {
      throw new ConflictErrorException("WEBHOOK_DELIVERY_RETRY_CONFLICT");
    }
    return { delivery: this.toWebhookDelivery(delivery) };
  }

  /** 저장 전에 서버 평가기와 같은 규칙으로 조건 문법을 검사합니다. */
  private validateCondition(condition: string): void {
    try {
      this.evaluator.matches(condition, {
        tool: { name: "__lynx_validation__" },
        input: {},
      });
    } catch (error) {
      throw new BadRequestErrorException(
        error instanceof Error ? error.message : "INVALID_POLICY_CONDITION",
      );
    }
  }

  /** 워크스페이스 밖의 정책을 노출하지 않도록 단건 조회합니다. */
  private async findPolicy(workspaceId: string, policyId: number) {
    const policy = await this.repository.find(workspaceId, policyId);
    if (!policy) throw new NotFoundErrorException("POLICY_NOT_FOUND");
    return policy;
  }

  /** 저장 엔티티를 정책 외부 응답으로 변환합니다. */
  private toResponse(
    policy: FirewallPolicyEntity,
    stats?: FirewallPolicyViolationStats,
  ): FirewallPolicyResponseDto {
    return {
      id: String(policy.id),
      name: policy.name,
      description: policy.description ?? null,
      condition: policy.condition,
      severity: policy.severity,
      action: policy.action,
      version: policy.version,
      webhookUrl: policy.webhookUrl,
      environments: policy.environments ?? [],
      agentIds: policy.agentIds ?? [],
      activated: policy.activated,
      draftRevision: policy.draftRevision,
      deployedRevision: policy.deployedRevision,
      isDirty: policy.deployedRevision !== policy.draftRevision,
      lastMatchedAt: stats?.lastMatchedAt?.toISOString() ?? null,
      recentBlockCount: stats?.recentBlockCount ?? 0,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
  }

  /** 불변 리비전을 버전 이력 응답으로 변환합니다. */
  private toRevisionResponse(
    revision: FirewallPolicyRevisionEntity,
    deployedRevision: number | null,
  ): FirewallPolicyRevisionResponseDto {
    return {
      id: revision.id,
      revision: revision.revision,
      name: revision.name,
      description: revision.description,
      condition: revision.condition,
      severity: revision.severity,
      action: revision.action,
      version: revision.version,
      webhookUrl: revision.webhookUrl,
      environments: revision.environments ?? [],
      agentIds: revision.agentIds ?? [],
      isDeployed: revision.revision === deployedRevision,
      createdAt: revision.createdAt.toISOString(),
      deployedAt: revision.deployedAt?.toISOString() ?? null,
    };
  }

  /** 민감한 query 값을 제외하고 운영 화면에 필요한 전송 상태만 반환합니다. */
  private toWebhookDelivery(delivery: WebhookDeliveryEntity) {
    return {
      id: delivery.id,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
      status: delivery.status,
      destination: this.sanitizeWebhookDestination(delivery.destinationUrl),
      policyRevision: delivery.policyRevision,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextAttemptAt: delivery.nextAttemptAt.toISOString(),
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
      responseStatus: delivery.responseStatus,
      lastError: delivery.lastError,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
    };
  }

  private sanitizeWebhookDestination(value: string): string {
    const destination = new URL(value);
    return `${destination.origin}${destination.pathname}`;
  }

  /** 위반 저장 모델에서 정책, Agent, Run 정보를 안전하게 추출합니다. */
  private toRecordResponse(record: FirewallViolationEntity) {
    const environment =
      this.readString(record.evidence?.environment) ??
      this.readString(record.event?.payload?.environment);
    return {
      id: record.id,
      action: record.action,
      severity: record.severity,
      message: record.message,
      evidence: record.evidence,
      createdAt: record.createdAt.toISOString(),
      policy: record.reason
        ? { id: String(record.reason.id), name: record.reason.name }
        : null,
      reportedPolicyId: record.reportedPolicyId,
      toolName: record.toolName,
      agent: record.agent
        ? { id: record.agent.id, name: record.agent.name }
        : null,
      runId: record.event?.run?.id ?? null,
      sessionId: record.session?.id ?? null,
      eventId: record.eventId,
      environment,
    };
  }

  /** unknown 값이 문자열일 때만 운영 화면에 노출합니다. */
  private readString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  /** 워크스페이스 조회 권한을 확인합니다. */
  private assertRead(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
  }

  /** 정책 변경에 필요한 워크스페이스 수정 권한을 확인합니다. */
  private assertWrite(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_UPDATE,
    });
  }
}

export const firewallPolicyService = new FirewallPolicyService();
