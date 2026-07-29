import { AdminAuditLogEntity } from "@repo/database";
import type { DataSource } from "typeorm";

import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { logger } from "../logger/logger.js";

export interface RecordAuditLogInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  workspaceId?: string;
  organizationId?: string;
  requestId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRecorder {
  record(input: RecordAuditLogInput): Promise<void>;
}

/** 관리 작업의 주체와 대상을 민감한 요청 본문 없이 저장합니다. */
export class AuditLogService implements AuditLogRecorder {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    if (!this.dataSource.isInitialized) return;

    try {
      const repository = this.dataSource.getRepository(AdminAuditLogEntity);
      await repository.save(
        repository.create({
          actorUserId: input.actorUserId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          workspaceId: input.workspaceId ?? null,
          organizationId: input.organizationId ?? null,
          requestId: input.requestId ?? null,
          before: input.before,
          after: input.after,
          metadata: input.metadata ?? null,
        }),
      );
    } catch (error) {
      // 감사 기록 장애가 이미 성공한 고객 작업을 실패 응답으로 바꾸지 않게 합니다.
      logger.error(
        {
          event: "audit_log.write_failed",
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          err: error,
        },
        "failed to write audit log",
      );
    }
  }
}

export const auditLogService = new AuditLogService();
