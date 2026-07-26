import {
  ISSUE_ACTIVITY_TYPE,
  ISSUE_ACTOR_TYPE,
  ISSUE_STATUS,
  type IssueStatus,
} from "@repo/constants";
import {
  IssueActivityEntity,
  IssueEntity,
  IssueEvaluationEntity,
  IssueOccurrenceEntity,
  UserEntity,
} from "@repo/database";
import type {
  GetIssueEvaluationsQueryDto,
  GetIssueOccurrencesQueryDto,
  GetIssuesQueryDto,
  GetIssuesSummaryQueryDto,
} from "@repo/dto";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { canTransitionIssueStatus } from "../../common/policies/issue-status-transition.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

type SummaryRow = {
  total: string;
  open: string;
  investigating: string;
  resolved: string;
  ignored: string;
  critical: string;
  warning: string;
  info: string;
  newIssues: string;
};

type OccurrenceSummaryRow = {
  occurrences: string;
  blockedOccurrences: string;
  affectedSessions: string;
};

/** 이슈 조회와 상태 변경에 필요한 DB 접근을 담당합니다. */
export class IssuesRepository {
  /** 다음 페이지 여부를 판단할 수 있도록 요청 개수보다 한 건 더 조회합니다. */
  list(workspaceId: string, input: GetIssuesQueryDto) {
    const query = AppDataSource.getRepository(IssueEntity)
      .createQueryBuilder("issue")
      .leftJoinAndSelect("issue.agent", "agent")
      .where('issue."workspaceId" = :workspaceId', { workspaceId })
      .orderBy("issue.lastSeenAt", "DESC")
      .addOrderBy("issue.id", "DESC")
      .take(input.limit + 1);

    if (input.status) {
      query.andWhere("issue.status = :status", { status: input.status });
    }
    if (input.severity) {
      query.andWhere("issue.severity = :severity", {
        severity: input.severity,
      });
    }
    if (input.category) {
      query.andWhere("issue.category = :category", {
        category: input.category,
      });
    }
    if (input.agentId) {
      query.andWhere('issue."agentId" = :agentId', {
        agentId: input.agentId,
      });
    }
    if (input.environment) {
      query.andWhere("issue.environment = :environment", {
        environment: input.environment,
      });
    }
    if (input.isBlocked !== undefined) {
      query.andWhere(
        input.isBlocked
          ? 'issue."blockedOccurrenceCount" > 0'
          : 'issue."blockedOccurrenceCount" = 0',
      );
    }
    this.applyDescendingCursor(query, "issue", input.cursor);
    return query.getMany();
  }

  /** 워크스페이스 경계 안에서 이슈 상세와 대표 관계를 조회합니다. */
  findIssue(workspaceId: string, issueId: string) {
    return AppDataSource.getRepository(IssueEntity).findOne({
      where: { id: issueId, workspaceId },
      relations: {
        agent: true,
        policy: true,
        representativePromptVersion: true,
      },
    });
  }

  /** 이슈 발생 내역을 최근순 커서 페이지로 조회합니다. */
  listOccurrences(
    workspaceId: string,
    issueId: string,
    input: GetIssueOccurrencesQueryDto,
  ) {
    const query = AppDataSource.getRepository(IssueOccurrenceEntity)
      .createQueryBuilder("occurrence")
      .innerJoinAndSelect("occurrence.session", "session")
      .leftJoinAndSelect("occurrence.event", "event")
      .leftJoinAndSelect("event.run", "run")
      .leftJoinAndSelect("occurrence.agent", "agent")
      .leftJoinAndSelect("occurrence.policy", "policy")
      .leftJoinAndSelect("occurrence.promptVersion", "promptVersion")
      .where('occurrence."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('occurrence."issueId" = :issueId', { issueId })
      .orderBy("occurrence.detectedAt", "DESC")
      .addOrderBy("occurrence.id", "DESC")
      .take(input.limit + 1);

    if (input.environment) {
      query.andWhere("occurrence.environment = :environment", {
        environment: input.environment,
      });
    }
    if (input.isBlocked !== undefined) {
      query.andWhere('occurrence."isBlocked" = :isBlocked', {
        isBlocked: input.isBlocked,
      });
    }
    this.applyDescendingCursor(query, "occurrence", input.cursor, "detectedAt");
    return query.getMany();
  }

  /** 이슈에 연결된 평가 결과를 최근순 커서 페이지로 조회합니다. */
  listEvaluations(
    workspaceId: string,
    issueId: string,
    input: GetIssueEvaluationsQueryDto,
  ) {
    const query = AppDataSource.getRepository(IssueEvaluationEntity)
      .createQueryBuilder("evaluation")
      .where('evaluation."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('evaluation."matchedIssueId" = :issueId', { issueId })
      .orderBy("evaluation.createdAt", "DESC")
      .addOrderBy("evaluation.id", "DESC")
      .take(input.limit + 1);
    this.applyDescendingCursor(query, "evaluation", input.cursor, "createdAt");
    return query.getMany();
  }

  /** 이슈와 발생 건을 DB에서 집계해 대시보드 요약을 반환합니다. */
  async getSummary(
    workspaceId: string,
    input: GetIssuesSummaryQueryDto,
  ): Promise<{
    issues: SummaryRow;
    occurrences: OccurrenceSummaryRow;
    reopenedIssues: string;
  }> {
    const issueQuery = AppDataSource.getRepository(IssueEntity)
      .createQueryBuilder("issue")
      .select("COUNT(*)", "total")
      .addSelect(
        `COUNT(*) FILTER (WHERE issue.status = '${ISSUE_STATUS.OPEN}')`,
        "open",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE issue.status = '${ISSUE_STATUS.INVESTIGATING}')`,
        "investigating",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE issue.status = '${ISSUE_STATUS.RESOLVED}')`,
        "resolved",
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE issue.status = '${ISSUE_STATUS.IGNORED}')`,
        "ignored",
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE issue.severity = 'CRITICAL')",
        "critical",
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE issue.severity = 'WARNING')",
        "warning",
      )
      .addSelect("COUNT(*) FILTER (WHERE issue.severity = 'INFO')", "info")
      .addSelect(
        `COUNT(*) FILTER (
          WHERE (:from::timestamptz IS NULL OR issue."firstSeenAt" >= :from)
            AND (:to::timestamptz IS NULL OR issue."firstSeenAt" <= :to)
        )`,
        "newIssues",
      )
      .where('issue."workspaceId" = :workspaceId', { workspaceId });

    const occurrenceQuery = AppDataSource.getRepository(IssueOccurrenceEntity)
      .createQueryBuilder("occurrence")
      .select("COUNT(*)", "occurrences")
      .addSelect(
        `COUNT(*) FILTER (WHERE occurrence."isBlocked" = true)`,
        "blockedOccurrences",
      )
      .addSelect(`COUNT(DISTINCT occurrence."sessionId")`, "affectedSessions")
      .where('occurrence."workspaceId" = :workspaceId', { workspaceId });

    const activityQuery = AppDataSource.getRepository(IssueActivityEntity)
      .createQueryBuilder("activity")
      .innerJoin("activity.issue", "issue")
      .select("COUNT(DISTINCT activity.issueId)", "reopenedIssues")
      .where('activity."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("activity.type = :reopened", {
        reopened: ISSUE_ACTIVITY_TYPE.REOPENED,
      });

    for (const query of [issueQuery, occurrenceQuery]) {
      if (input.environment) {
        query.andWhere(`${query.alias}.environment = :environment`, {
          environment: input.environment,
        });
      }
    }
    if (input.environment) {
      activityQuery.andWhere("issue.environment = :environment", {
        environment: input.environment,
      });
    }
    this.applyDateRange(issueQuery, "issue", "lastSeenAt", input);
    this.applyDateRange(occurrenceQuery, "occurrence", "detectedAt", input);
    this.applyDateRange(activityQuery, "activity", "createdAt", input);

    issueQuery.setParameters({
      from: input.from ?? null,
      to: input.to ?? null,
    });

    const [issues, occurrences, activities] = await Promise.all([
      issueQuery.getRawOne<SummaryRow>(),
      occurrenceQuery.getRawOne<OccurrenceSummaryRow>(),
      activityQuery.getRawOne<{ reopenedIssues: string }>(),
    ]);

    return {
      issues: issues!,
      occurrences: occurrences!,
      reopenedIssues: activities?.reopenedIssues ?? "0",
    };
  }

  /** 이슈 상태와 해결 정보를 변경하고 감사 Activity를 함께 저장합니다. */
  async updateStatus(input: {
    workspaceId: string;
    issueId: string;
    userId: string;
    status: IssueStatus;
    reason?: string;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const issueRepository = manager.getRepository(IssueEntity);
      const issue = await issueRepository.findOne({
        where: { id: input.issueId, workspaceId: input.workspaceId },
        relations: { resolvedByUser: true },
        lock: { mode: "pessimistic_write" },
      });
      if (!issue) throw new Error("ISSUE_NOT_FOUND");
      if (!canTransitionIssueStatus(issue.status, input.status)) {
        throw new Error("INVALID_ISSUE_STATUS_TRANSITION");
      }
      if (issue.status === input.status) return issue;

      const user = await manager
        .getRepository(UserEntity)
        .findOneBy({ id: input.userId });
      if (!user) throw new Error("USER_NOT_FOUND");

      const previousStatus = issue.status;
      issue.status = input.status;
      if (input.status === ISSUE_STATUS.RESOLVED) {
        issue.resolvedAt = new Date();
        issue.resolvedByUserId = user.id;
        issue.resolvedByUser = user;
      } else {
        issue.resolvedAt = null;
        issue.resolvedByUserId = null;
        issue.resolvedByUser = null;
      }
      const saved = await issueRepository.save(issue);

      await manager.getRepository(IssueActivityEntity).save({
        workspaceId: input.workspaceId,
        issueId: issue.id,
        type: ISSUE_ACTIVITY_TYPE.STATUS_CHANGED,
        actorType: ISSUE_ACTOR_TYPE.USER,
        actorUserId: user.id,
        actorName: user.name,
        body: input.reason ?? null,
        metadata: {
          previousStatus,
          nextStatus: input.status,
        },
      });
      return saved;
    });
  }

  private applyDescendingCursor<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    alias: string,
    cursor?: string,
    dateField = "lastSeenAt",
  ): void {
    if (!cursor) return;
    const separator = cursor.lastIndexOf("|");
    const date = cursor.slice(0, separator);
    const id = cursor.slice(separator + 1);
    query.andWhere(
      `(
        ${alias}."${dateField}" < :cursorDate
        OR (
          ${alias}."${dateField}" = :cursorDate
          AND ${alias}.id < :cursorId
        )
      )`,
      { cursorDate: date, cursorId: id },
    );
  }

  private applyDateRange<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    input: GetIssuesSummaryQueryDto,
  ): void {
    if (input.from) {
      query.andWhere(`${alias}."${field}" >= :from`, { from: input.from });
    }
    if (input.to) {
      query.andWhere(`${alias}."${field}" <= :to`, { to: input.to });
    }
  }
}

/** 이슈 API에서 사용하는 기본 저장소 인스턴스입니다. */
export const issuesRepository = new IssuesRepository();
