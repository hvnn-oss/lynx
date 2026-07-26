import type {
  CreateFirewallPolicyDto,
  FirewallPolicyResponseDto,
  SimulateFirewallPolicyDto,
  UpdateFirewallPolicyDto,
} from "@repo/dto";
import type { FirewallPolicyEntity } from "@repo/database";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import { PolicyConditionEvaluator } from "../../common/firewall/policy-condition-evaluator.js";
import { runtimeConfigService } from "../openapi/runtime-config/runtime-config.service.js";
import {
  FirewallPolicyRepository,
  firewallPolicyRepository,
} from "./firewall-policy.repository.js";

/** 정책 관리 권한과 배포 수명주기를 담당합니다. */
export class FirewallPolicyService {
  constructor(
    private readonly repository: FirewallPolicyRepository = firewallPolicyRepository,
    private readonly accessControl: AccessControlService = accessControlService,
    private readonly evaluator = new PolicyConditionEvaluator(),
  ) {}

  /** 읽기 권한이 있는 사용자의 정책 목록을 반환합니다. */
  async list(userId: string, workspaceId: string) {
    await this.assertRead(userId, workspaceId);
    return {
      items: (await this.repository.list(workspaceId)).map((policy) =>
        this.toResponse(policy),
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

  /** 배포본과 분리된 정책 초안을 수정합니다. */
  async update(
    userId: string,
    workspaceId: string,
    policyId: number,
    body: UpdateFirewallPolicyDto,
  ) {
    await this.assertWrite(userId, workspaceId);
    if (body.condition) this.validateCondition(body.condition);
    const policy = await this.findPolicy(workspaceId, policyId);
    return {
      policy: this.toResponse(await this.repository.update(policy, body)),
    };
  }

  /** 현재 초안을 새 배포 리비전으로 게시합니다. */
  async deploy(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const deployed = await this.repository.deploy(policy);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(deployed) };
  }

  /** 이미 배포된 정책을 런타임에 다시 활성화합니다. */
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

  /** 정책을 삭제하지 않고 런타임 배포본에서 제외합니다. */
  async deactivate(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    const deactivated = await this.repository.setActivated(policy, false);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(deactivated) };
  }

  /** 지정한 과거 리비전을 다시 런타임 배포본으로 지정합니다. */
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
    if (!revision)
      throw new NotFoundErrorException("POLICY_REVISION_NOT_FOUND");
    const rolledBack = await this.repository.rollback(policy, revision);
    runtimeConfigService.invalidate(workspaceId);
    return { policy: this.toResponse(rolledBack) };
  }

  /** 현재 초안을 SDK와 동일한 조건 문법으로 부작용 없이 시험합니다. */
  async simulate(
    userId: string,
    workspaceId: string,
    policyId: number,
    body: SimulateFirewallPolicyDto,
  ) {
    await this.assertRead(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    return {
      matched: this.evaluator.matches(policy.condition, body),
      action: policy.action,
      severity: policy.severity,
      policyId: String(policy.id),
      version: policy.version,
      revision: policy.draftRevision,
    };
  }

  /** 정책과 위반 이력을 보존하기 위해 소프트 삭제합니다. */
  async delete(userId: string, workspaceId: string, policyId: number) {
    await this.assertWrite(userId, workspaceId);
    const policy = await this.findPolicy(workspaceId, policyId);
    await this.repository.softDelete(policy);
    runtimeConfigService.invalidate(workspaceId);
    return { deleted: true as const };
  }

  /** 저장 전에 조건 문법을 실제 평가기와 같은 규칙으로 검사합니다. */
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

  /** 워크스페이스에 속한 삭제되지 않은 정책을 조회합니다. */
  private async findPolicy(workspaceId: string, policyId: number) {
    const policy = await this.repository.find(workspaceId, policyId);
    if (!policy) throw new NotFoundErrorException("POLICY_NOT_FOUND");
    return policy;
  }

  /** 저장 엔티티를 외부 정책 응답으로 변환합니다. */
  private toResponse(
    policy: FirewallPolicyEntity,
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
      activated: policy.activated,
      draftRevision: policy.draftRevision,
      deployedRevision: policy.deployedRevision,
      isDirty: policy.deployedRevision !== policy.draftRevision,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
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
