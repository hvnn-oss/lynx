import {
  FirewallApprovalRequestEntity,
  FirewallPolicyEntity,
} from "@repo/database";
import type { CreateFirewallApprovalDto } from "@repo/dto";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";
import { firewallNotificationService } from "../../../common/services/firewall-notification.service.js";

/** SDK 승인 요청을 워크스페이스 경계 안에서 저장하고 조회합니다. */
export class OpenAPIApprovalRepository {
  /** 클라이언트 요청 ID를 기준으로 승인 요청을 멱등 생성합니다. */
  async create(
    workspaceId: string,
    sdkInstanceId: string,
    body: CreateFirewallApprovalDto,
  ) {
    try {
      return await AppDataSource.transaction(async (manager) => {
        const repository = manager.getRepository(FirewallApprovalRequestEntity);
        const existing = await repository.findOneBy({
          workspaceId,
          sdkInstanceId,
          clientRequestId: body.clientRequestId,
        });
        if (existing) return { request: existing, isNew: false };
        const policy =
          body.policyId && /^\d+$/.test(body.policyId)
            ? await manager.getRepository(FirewallPolicyEntity).findOne({
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
        await firewallNotificationService.enqueueConfigured(manager, {
          workspaceId,
          policyId: request.reportedPolicyId,
          type: "approval.requested",
          deduplicationKey: `approval.requested:${request.id}`,
          data: {
            approvalId: request.id,
            toolName: request.toolName,
            runId: request.runId,
            sessionId: request.sessionId,
            agentId: request.agentId,
            expiresAt: request.expiresAt.toISOString(),
          },
        });
        return { request, isNew: true };
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const request = await AppDataSource.getRepository(
        FirewallApprovalRequestEntity,
      ).findOneByOrFail({
        workspaceId,
        sdkInstanceId,
        clientRequestId: body.clientRequestId,
      });
      return { request, isNew: false };
    }
  }

  /** 승인 요청이 같은 워크스페이스와 SDK 인스턴스에 속하는지 확인합니다. */
  find(workspaceId: string, sdkInstanceId: string, approvalId: string) {
    return AppDataSource.getRepository(FirewallApprovalRequestEntity).findOneBy(
      {
        id: approvalId,
        workspaceId,
        sdkInstanceId,
      },
    );
  }

  /** 대기 기한이 지난 요청을 만료 상태로 전환합니다. */
  async expire(request: FirewallApprovalRequestEntity) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(FirewallApprovalRequestEntity);
      const current = await repository
        .createQueryBuilder("approval")
        .setLock("pessimistic_write")
        .where("approval.id = :id", { id: request.id })
        .getOneOrFail();
      if (current.status !== "PENDING") return current;
      current.status = "EXPIRED";
      const decidedAt = new Date();
      current.decidedAt = decidedAt;
      current.decisionReason = "Approval request expired.";
      const saved = await repository.save(current);
      await firewallNotificationService.enqueueConfigured(manager, {
        workspaceId: saved.workspaceId,
        policyId: saved.reportedPolicyId,
        type: "approval.decided",
        deduplicationKey: `approval.decided:${saved.id}`,
        data: {
          approvalId: saved.id,
          status: saved.status,
          decidedAt: decidedAt.toISOString(),
          decisionReason: saved.decisionReason,
          toolName: saved.toolName,
          runId: saved.runId,
        },
      });
      return saved;
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }
}

export const openAPIApprovalRepository = new OpenAPIApprovalRepository();
