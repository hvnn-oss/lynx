import type { DataSource, EntityManager } from "typeorm";

import { AppDataSource } from "../../provider/database/typeorm-config.js";

export interface DataRetentionBatchResult {
  deletedIssueRecords: number;
  deletedSessions: number;
}

/**
 * 조직 요금제의 보존 기간이 지난 원본 실행 데이터를 작은 배치로 삭제합니다.
 */
export class DataRetentionRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  /**
   * 오래된 Session과 Issue Record를 삭제하고 남은 Issue 집계값을 다시 맞춥니다.
   */
  async purgeBatch(limit: number): Promise<DataRetentionBatchResult> {
    return this.dataSource.transaction(async (manager) => {
      const deletedSessions = await this.deleteExpiredSessions(manager, limit);
      const deletedIssueRecords = await this.deleteExpiredIssueRecords(
        manager,
        limit,
      );

      return { deletedIssueRecords, deletedSessions };
    });
  }

  private async deleteExpiredSessions(
    manager: EntityManager,
    limit: number,
  ): Promise<number> {
    const expiredSessions = await manager.query<Array<{ id: string }>>(
      `
        SELECT session.id
        FROM "session" session
        INNER JOIN "workspace" workspace
          ON workspace.id = session."workspaceId"
        INNER JOIN "organization" organization
          ON organization.id = workspace."organizationId"
        INNER JOIN "organization_plan" plan
          ON plan.id = organization."planId"
        WHERE session."startedAt" <
          now() - make_interval(days => GREATEST(plan."retentionDays", 1))
        ORDER BY session."startedAt" ASC, session.id ASC
        LIMIT $1
        FOR UPDATE OF session SKIP LOCKED
      `,
      [limit],
    );
    const sessionIds = expiredSessions.map((session) => session.id);
    if (sessionIds.length === 0) return 0;

    const affectedIssues = await manager.query<Array<{ issueId: string }>>(
      `
        SELECT DISTINCT occurrence."issueId" AS "issueId"
        FROM "issue_occurrence" occurrence
        WHERE occurrence."sessionId" = ANY($1::uuid[])
      `,
      [sessionIds],
    );
    const issueIds = affectedIssues.map((issue) => issue.issueId);

    const deleted = await manager.query<Array<{ id: string }>>(
      `
        DELETE FROM "session"
        WHERE id = ANY($1::uuid[])
        RETURNING id
      `,
      [sessionIds],
    );

    if (issueIds.length > 0) {
      await this.reconcileIssues(manager, issueIds);
    }

    return deleted.length;
  }

  private async deleteExpiredIssueRecords(
    manager: EntityManager,
    limit: number,
  ): Promise<number> {
    const deleted = await manager.query<Array<{ id: string }>>(
      `
        WITH expired_records AS (
          SELECT record.id
          FROM "issue_record" record
          INNER JOIN "workspace" workspace
            ON workspace.id = record."workspaceId"
          INNER JOIN "organization" organization
            ON organization.id = workspace."organizationId"
          INNER JOIN "organization_plan" plan
            ON plan.id = organization."planId"
          WHERE record."detectedAt" <
            now() - make_interval(days => GREATEST(plan."retentionDays", 1))
          ORDER BY record."detectedAt" ASC, record.id ASC
          LIMIT $1
          FOR UPDATE OF record SKIP LOCKED
        )
        DELETE FROM "issue_record" record
        USING expired_records
        WHERE record.id = expired_records.id
        RETURNING record.id
      `,
      [limit],
    );

    return deleted.length;
  }

  private async reconcileIssues(
    manager: EntityManager,
    issueIds: string[],
  ): Promise<void> {
    // Session 삭제로 함께 제거된 Occurrence를 기준으로 Issue 요약값을 복구합니다.
    await manager.query(
      `
        UPDATE "issue" issue
        SET
          "occurrenceCount" = (
            SELECT COUNT(*)::int
            FROM "issue_occurrence" occurrence
            WHERE occurrence."issueId" = issue.id
          ),
          "affectedSessionCount" = (
            SELECT COUNT(DISTINCT occurrence."sessionId")::int
            FROM "issue_occurrence" occurrence
            WHERE occurrence."issueId" = issue.id
          ),
          "blockedOccurrenceCount" = (
            SELECT COUNT(*)::int
            FROM "issue_occurrence" occurrence
            WHERE occurrence."issueId" = issue.id
              AND occurrence."isBlocked" = TRUE
          ),
          "representativeOccurrenceId" = (
            SELECT occurrence.id
            FROM "issue_occurrence" occurrence
            WHERE occurrence."issueId" = issue.id
            ORDER BY occurrence."detectedAt" DESC, occurrence.id DESC
            LIMIT 1
          ),
          "firstSeenAt" = COALESCE((
            SELECT MIN(occurrence."detectedAt")
            FROM "issue_occurrence" occurrence
            WHERE occurrence."issueId" = issue.id
          ), issue."firstSeenAt"),
          "lastSeenAt" = COALESCE((
            SELECT MAX(occurrence."detectedAt")
            FROM "issue_occurrence" occurrence
            WHERE occurrence."issueId" = issue.id
          ), issue."lastSeenAt"),
          "updatedAt" = now()
        WHERE issue.id = ANY($1::uuid[])
      `,
      [issueIds],
    );
  }
}

export const dataRetentionRepository = new DataRetentionRepository();
