import { randomUUID } from "node:crypto";
import { FirewallPolicyRevisionEntity } from "@repo/database";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { getWebhookService } from "../../provider/webhook/webhook-provider.js";
import type { FirewallWebhookEvent } from "../../provider/webhook/webhook.service.js";

/** 정책의 현재 배포 Webhook으로 방화벽 알림을 비동기 전달합니다. */
export class FirewallNotificationService {
  /** 알림 실패를 원래 이벤트 저장이나 도구 실행 결과와 격리합니다. */
  notify(input: {
    workspaceId: string;
    policyId?: string | null;
    type: FirewallWebhookEvent["type"];
    data: Record<string, unknown>;
  }): void {
    void this.deliver(input).catch(() => {
      // Webhook 장애는 수집 및 승인 상태 변경을 되돌리지 않습니다.
    });
  }

  /** 배포 리비전의 목적지를 조회한 뒤 표준 이벤트를 전송합니다. */
  private async deliver(input: {
    workspaceId: string;
    policyId?: string | null;
    type: FirewallWebhookEvent["type"];
    data: Record<string, unknown>;
  }): Promise<void> {
    if (!input.policyId || !/^\d+$/.test(input.policyId)) return;
    const revision = await AppDataSource.getRepository(
      FirewallPolicyRevisionEntity,
    )
      .createQueryBuilder("revision")
      .innerJoin("revision.policy", "policy")
      .innerJoin("policy.workspace", "workspace")
      .where("policy.id = :policyId", { policyId: input.policyId })
      .andWhere("workspace.id = :workspaceId", {
        workspaceId: input.workspaceId,
      })
      .andWhere("policy.activated = true")
      .andWhere("revision.revision = policy.deployedRevision")
      .getOne();
    if (!revision?.webhookUrl) return;
    await getWebhookService().send(revision.webhookUrl, {
      id: randomUUID(),
      type: input.type,
      occurredAt: new Date().toISOString(),
      workspaceId: input.workspaceId,
      data: input.data,
    });
  }
}

export const firewallNotificationService = new FirewallNotificationService();
