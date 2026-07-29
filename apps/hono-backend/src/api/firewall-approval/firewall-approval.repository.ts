import { FirewallApprovalRequestEntity } from "@repo/database";
import type { DecideFirewallApprovalDto } from "@repo/dto";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { firewallNotificationService } from "../../common/services/firewall-notification.service.js";

/** 운영자 승인 목록과 원자적인 승인 결정을 저장합니다. */
export class FirewallApprovalRepository {
  /** 워크스페이스의 최신 승인 요청을 제한된 개수로 조회합니다. */
  list(workspaceId: string, status: string | undefined, limit: number) {
    const query = AppDataSource.getRepository(FirewallApprovalRequestEntity)
      .createQueryBuilder("approval")
      .where("approval.workspaceId = :workspaceId", { workspaceId })
      .orderBy("approval.requestedAt", "DESC")
      .take(limit);
    if (status) query.andWhere("approval.status = :status", { status });
    return query.getMany();
  }

  /** 하나의 대기 요청에 최초 결정만 반영합니다. */
  decide(
    workspaceId: string,
    approvalId: string,
    userId: string,
    body: DecideFirewallApprovalDto,
  ) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(FirewallApprovalRequestEntity);
      const request = await repository
        .createQueryBuilder("approval")
        .setLock("pessimistic_write")
        .where("approval.id = :approvalId", { approvalId })
        .andWhere("approval.workspaceId = :workspaceId", { workspaceId })
        .getOne();
      if (!request) return null;
      if (request.status !== "PENDING") {
        return { request, didDecide: false };
      }
      const now = new Date();
      request.status = request.expiresAt <= now ? "EXPIRED" : body.decision;
      request.decidedAt = now;
      request.decidedByUserId = request.status === "EXPIRED" ? null : userId;
      request.decisionReason =
        request.status === "EXPIRED"
          ? "Approval request expired."
          : (body.reason ?? null);
      const saved = await repository.save(request);
      await firewallNotificationService.enqueueConfigured(manager, {
        workspaceId,
        policyId: saved.reportedPolicyId,
        type: "approval.decided",
        deduplicationKey: `approval.decided:${saved.id}`,
        data: {
          approvalId: saved.id,
          status: saved.status,
          decidedAt: saved.decidedAt?.toISOString() ?? null,
          decisionReason: saved.decisionReason,
          toolName: saved.toolName,
          runId: saved.runId,
        },
      });
      return { request: saved, didDecide: true };
    });
  }
}

export const firewallApprovalRepository = new FirewallApprovalRepository();
