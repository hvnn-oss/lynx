import type { DecideFirewallApprovalDto } from "@repo/dto";
import type { FirewallApprovalRequestEntity } from "@repo/database";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import {
  FirewallApprovalRepository,
  firewallApprovalRepository,
} from "./firewall-approval.repository.js";

/** 운영자 승인 목록 조회와 승인·거절 결정을 처리합니다. */
export class FirewallApprovalService {
  constructor(
    private readonly repository: FirewallApprovalRepository = firewallApprovalRepository,
    private readonly accessControl: AccessControlService = accessControlService,
  ) {}

  /** 읽기 권한이 있는 운영자에게 승인 요청 목록을 반환합니다. */
  async list(
    userId: string,
    workspaceId: string,
    query: { status?: string; limit: number },
  ) {
    await this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
    return {
      items: (
        await this.repository.list(workspaceId, query.status, query.limit)
      ).map((request) => ({
        ...this.toStatus(request),
        policyId: request.reportedPolicyId,
        toolName: request.toolName,
        runId: request.runId,
        sessionId: request.sessionId,
        agentId: request.agentId,
        requestReason: request.requestReason,
        requestedAt: request.requestedAt.toISOString(),
      })),
    };
  }

  /** 수정 권한이 있는 운영자의 최초 승인 또는 거절 결정을 반영합니다. */
  async decide(
    userId: string,
    workspaceId: string,
    approvalId: string,
    body: DecideFirewallApprovalDto,
  ) {
    await this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_UPDATE,
    });
    const result = await this.repository.decide(
      workspaceId,
      approvalId,
      userId,
      body,
    );
    if (!result) throw new NotFoundErrorException("APPROVAL_NOT_FOUND");
    const request = result.request;
    return this.toStatus(request);
  }

  /** 승인 저장 모델을 공통 상태 응답으로 변환합니다. */
  private toStatus(request: FirewallApprovalRequestEntity) {
    return {
      id: request.id,
      status: request.status,
      expiresAt: request.expiresAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decisionReason: request.decisionReason,
    };
  }
}

export const firewallApprovalService = new FirewallApprovalService();
