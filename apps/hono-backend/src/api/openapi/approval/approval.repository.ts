import {
  FirewallApprovalRequestEntity,
  FirewallPolicyEntity,
} from "@repo/database";
import type { CreateFirewallApprovalDto } from "@repo/dto";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";

/** SDK 승인 요청을 워크스페이스 경계 안에서 저장하고 조회합니다. */
export class OpenAPIApprovalRepository {
  /** 클라이언트 요청 ID를 기준으로 승인 요청을 멱등 생성합니다. */
  async create(
    workspaceId: string,
    sdkInstanceId: string,
    body: CreateFirewallApprovalDto,
  ) {
    const repository = AppDataSource.getRepository(
      FirewallApprovalRequestEntity,
    );
    const existing = await repository.findOneBy({
      workspaceId,
      sdkInstanceId,
      clientRequestId: body.clientRequestId,
    });
    if (existing) return { request: existing, isNew: false };
    const policy =
      body.policyId && /^\d+$/.test(body.policyId)
        ? await AppDataSource.getRepository(FirewallPolicyEntity).findOne({
            where: {
              id: Number(body.policyId),
              workspace: { id: workspaceId },
            },
          })
        : null;
    const request = await repository.save(
      repository.create({
        workspaceId,
        policyId: policy ? String(policy.id) : null,
        reportedPolicyId: body.policyId ?? null,
        sdkInstanceId,
        clientRequestId: body.clientRequestId,
        runId: body.runId,
        sessionId: body.sessionId,
        agentId: body.agentId,
        toolName: body.toolName,
        inputHash: body.inputHash,
        requestReason: body.reason ?? null,
        status: "PENDING",
        expiresAt: new Date(Date.now() + body.timeoutMs),
        decidedAt: null,
        decidedByUserId: null,
        decisionReason: null,
      }),
    );
    return { request, isNew: true };
  }

  /** 승인 요청이 같은 워크스페이스와 SDK 인스턴스에 속하는지 확인합니다. */
  find(workspaceId: string, sdkInstanceId: string, approvalId: string) {
    return AppDataSource.getRepository(
      FirewallApprovalRequestEntity,
    ).findOneBy({
      id: approvalId,
      workspaceId,
      sdkInstanceId,
    });
  }

  /** 대기 기한이 지난 요청을 만료 상태로 전환합니다. */
  async expire(request: FirewallApprovalRequestEntity) {
    request.status = "EXPIRED";
    request.decidedAt = new Date();
    return AppDataSource.getRepository(FirewallApprovalRequestEntity).save(
      request,
    );
  }
}

export const openAPIApprovalRepository = new OpenAPIApprovalRepository();
