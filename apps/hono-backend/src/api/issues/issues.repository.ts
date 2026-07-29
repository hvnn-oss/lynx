import {
  ISSUE_ACTIVITY_TYPE,
  ISSUE_ACTOR_TYPE,
  ISSUE_STATUS,
  USER_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
  type IssueStatus,
  type UserPermissions,
  type WorkspacePermissions,
} from "@repo/constants";
import {
  IssueAssigneeEntity,
  IssueActivityEntity,
  IssueEntity,
  IssueEvaluationEntity,
  IssueOccurrenceEntity,
  IssueRecordProcessingEntity,
  OrganizationUserEntity,
  UserEntity,
  WorkspaceMembershipEntity,
} from "@repo/database";
import type {
  GetIssueActivitiesQueryDto,
  GetIssueEvaluationsQueryDto,
  GetIssueOccurrencesQueryDto,
  GetIssueRecordsQueryDto,
  GetIssuesQueryDto,
  GetIssuesSummaryQueryDto,
} from "@repo/dto";
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm";
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

export type IssueRecordProcessingSummaryRow = {
  received: string;
  evaluating: string;
  decided: string;
  failed: string;
  recoveryPending: string;
  deferred: string;
  delayed: string;
  unsupported: string;
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

  /** 댓글과 상태·담당자 변경 Activity를 최근순 커서 페이지로 조회합니다. */
  listActivities(
    workspaceId: string,
    issueId: string,
    input: GetIssueActivitiesQueryDto,
  ) {
    const query = AppDataSource.getRepository(IssueActivityEntity)
      .createQueryBuilder("activity")
      .where('activity."workspaceId" = :workspaceId', { workspaceId })
      .andWhere('activity."issueId" = :issueId', { issueId })
      .orderBy("activity.createdAt", "DESC")
      .addOrderBy("activity.id", "DESC")
      .take(input.limit + 1);
    this.applyDescendingCursor(query, "activity", input.cursor, "createdAt");
    return query.getMany();
  }

  /** 사용자가 남긴 댓글을 변경 이력과 동일한 Activity로 저장합니다. */
  async createComment(input: {
    workspaceId: string;
    issueId: string;
    userId: string;
    body: string;
    mentionedUserIds: string[];
  }) {
    return AppDataSource.transaction(async (manager) => {
      const [issue, user] = await Promise.all([
        manager
          .getRepository(IssueEntity)
          .findOneBy({ id: input.issueId, workspaceId: input.workspaceId }),
        manager.getRepository(UserEntity).findOneBy({ id: input.userId }),
      ]);
      if (!issue) throw new Error("ISSUE_NOT_FOUND");
      if (!user) throw new Error("USER_NOT_FOUND");
      const mentionedUsers = await this.resolveMentionUsers(
        manager,
        input.workspaceId,
        input.mentionedUserIds,
      );

      const repository = manager.getRepository(IssueActivityEntity);
      return repository.save(
        repository.create({
          workspaceId: input.workspaceId,
          issueId: issue.id,
          type: ISSUE_ACTIVITY_TYPE.COMMENTED,
          actorType: ISSUE_ACTOR_TYPE.USER,
          actorUserId: user.id,
          actorName: user.name,
          body: input.body,
          editedAt: null,
          deletedAt: null,
          metadata: {
            mentions: mentionedUsers.map((mentionedUser) => ({
              userId: mentionedUser.id,
              name: mentionedUser.name,
            })),
          },
        }),
      );
    });
  }

  /** 작성자가 자신의 댓글 본문과 멘션 대상을 수정합니다. */
  async updateComment(input: {
    workspaceId: string;
    issueId: string;
    commentId: string;
    userId: string;
    body: string;
    mentionedUserIds: string[];
  }) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(IssueActivityEntity);
      const comment = await repository.findOne({
        where: {
          id: input.commentId,
          workspaceId: input.workspaceId,
          issueId: input.issueId,
          type: ISSUE_ACTIVITY_TYPE.COMMENTED,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!comment) throw new Error("ISSUE_COMMENT_NOT_FOUND");
      if (comment.actorUserId !== input.userId) {
        throw new Error("ISSUE_COMMENT_FORBIDDEN");
      }
      if (comment.deletedAt) throw new Error("ISSUE_COMMENT_DELETED");

      const mentionedUsers = await this.resolveMentionUsers(
        manager,
        input.workspaceId,
        input.mentionedUserIds,
      );
      comment.body = input.body;
      comment.editedAt = new Date();
      comment.metadata = {
        ...(comment.metadata ?? {}),
        mentions: mentionedUsers.map((mentionedUser) => ({
          userId: mentionedUser.id,
          name: mentionedUser.name,
        })),
      };
      return repository.save(comment);
    });
  }

  /** 작성자 댓글을 감사 이력은 유지한 채 소프트 삭제합니다. */
  async deleteComment(input: {
    workspaceId: string;
    issueId: string;
    commentId: string;
    userId: string;
  }) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(IssueActivityEntity);
      const comment = await repository.findOne({
        where: {
          id: input.commentId,
          workspaceId: input.workspaceId,
          issueId: input.issueId,
          type: ISSUE_ACTIVITY_TYPE.COMMENTED,
        },
        lock: { mode: "pessimistic_write" },
      });
      if (!comment) throw new Error("ISSUE_COMMENT_NOT_FOUND");
      if (comment.actorUserId !== input.userId) {
        throw new Error("ISSUE_COMMENT_FORBIDDEN");
      }
      if (comment.deletedAt) return comment;

      comment.body = null;
      comment.deletedAt = new Date();
      comment.metadata = {
        ...(comment.metadata ?? {}),
        mentions: [],
      };
      return repository.save(comment);
    });
  }

  /** 현재 담당자와 같은 조직에서 선택 가능한 사용자를 조회합니다. */
  async getAssignees(workspaceId: string, issueId: string) {
    const [assignees, availableUsers] = await Promise.all([
      AppDataSource.getRepository(IssueAssigneeEntity).find({
        where: { workspaceId, issueId },
        relations: { membership: { user: true } },
        order: { assignedAt: "ASC", id: "ASC" },
      }),
      AppDataSource.getRepository(OrganizationUserEntity)
        .createQueryBuilder("membership")
        .innerJoinAndSelect("membership.user", "user")
        .innerJoin("membership.organization", "organization")
        .innerJoin("organization.workspaces", "workspace")
        .where("workspace.id = :workspaceId", { workspaceId })
        .orderBy("user.name", "ASC")
        .addOrderBy("user.id", "ASC")
        .getMany(),
    ]);
    return { assignees, availableUsers };
  }

  /** 담당자 목록을 교체하고 추가·해제 이벤트를 같은 트랜잭션에 기록합니다. */
  async updateAssignees(input: {
    workspaceId: string;
    issueId: string;
    userId: string;
    assigneeUserIds: string[];
  }): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const issue = await manager.getRepository(IssueEntity).findOne({
        where: { id: input.issueId, workspaceId: input.workspaceId },
        lock: { mode: "pessimistic_write" },
      });
      if (!issue) throw new Error("ISSUE_NOT_FOUND");

      const actor = await manager
        .getRepository(UserEntity)
        .findOneBy({ id: input.userId });
      if (!actor) throw new Error("USER_NOT_FOUND");

      const organizationMembers = await manager
        .getRepository(OrganizationUserEntity)
        .createQueryBuilder("membership")
        .innerJoinAndSelect("membership.user", "user")
        .innerJoin("membership.organization", "organization")
        .innerJoin("organization.workspaces", "workspace")
        .where("workspace.id = :workspaceId", {
          workspaceId: input.workspaceId,
        })
        .getMany();
      const memberByUserId = new Map(
        organizationMembers.map((membership) => [
          membership.user.id,
          membership,
        ]),
      );
      if (input.assigneeUserIds.some((userId) => !memberByUserId.has(userId))) {
        throw new Error("ISSUE_ASSIGNEE_NOT_MEMBER");
      }

      const assigneeRepository = manager.getRepository(IssueAssigneeEntity);
      const existing = await assigneeRepository.findBy({
        workspaceId: input.workspaceId,
        issueId: input.issueId,
      });
      const existingIds = new Set(existing.map((assignee) => assignee.userId));
      const desiredIds = new Set(input.assigneeUserIds);
      const addedIds = input.assigneeUserIds.filter(
        (userId) => !existingIds.has(userId),
      );
      const removedIds = existing
        .map((assignee) => assignee.userId)
        .filter((userId) => !desiredIds.has(userId));

      if (addedIds.length > 0) {
        await manager
          .getRepository(WorkspaceMembershipEntity)
          .createQueryBuilder()
          .insert()
          .values(
            addedIds.map((userId) => {
              const membership = memberByUserId.get(userId)!;
              return {
                workspaceId: input.workspaceId,
                userId,
                role: this.toWorkspaceRole(membership.role),
                createdByUserId: actor.id,
              };
            }),
          )
          .orIgnore()
          .execute();
        await assigneeRepository.save(
          addedIds.map((userId) =>
            assigneeRepository.create({
              workspaceId: input.workspaceId,
              issueId: input.issueId,
              userId,
              assignedByUserId: actor.id,
            }),
          ),
        );
      }

      if (removedIds.length > 0) {
        await assigneeRepository
          .createQueryBuilder()
          .delete()
          .where('"workspaceId" = :workspaceId', {
            workspaceId: input.workspaceId,
          })
          .andWhere('"issueId" = :issueId', { issueId: input.issueId })
          .andWhere('"userId" IN (:...removedIds)', { removedIds })
          .execute();
      }

      const activityRepository = manager.getRepository(IssueActivityEntity);
      const activities = [
        ...addedIds.map((targetUserId) => ({
          type: ISSUE_ACTIVITY_TYPE.ASSIGNED,
          targetUserId,
        })),
        ...removedIds.map((targetUserId) => ({
          type: ISSUE_ACTIVITY_TYPE.UNASSIGNED,
          targetUserId,
        })),
      ].map(({ type, targetUserId }) => {
        const target = memberByUserId.get(targetUserId)?.user;
        return activityRepository.create({
          workspaceId: input.workspaceId,
          issueId: input.issueId,
          type,
          actorType: ISSUE_ACTOR_TYPE.USER,
          actorUserId: actor.id,
          actorName: actor.name,
          body: null,
          metadata: {
            targetUserId,
            targetName: target?.name ?? targetUserId,
          },
        });
      });
      if (activities.length > 0) {
        await activityRepository.save(activities);
      }
    });
  }

  /** SDK Issue Record와 현재 worker 처리 상태를 최근 순서로 조회합니다. */
  listRecordProcessing(workspaceId: string, input: GetIssueRecordsQueryDto) {
    const query = AppDataSource.getRepository(IssueRecordProcessingEntity)
      .createQueryBuilder("processing")
      .innerJoinAndSelect("processing.record", "record")
      .where('record."workspaceId" = :workspaceId', { workspaceId })
      .orderBy("record.detectedAt", "DESC")
      .addOrderBy("record.id", "DESC")
      .take(input.limit + 1);

    this.applyDescendingCursor(query, "record", input.cursor, "detectedAt");

    if (input.recordKind) {
      query.andWhere('record."recordKind" = :recordKind', {
        recordKind: input.recordKind,
      });
    }
    if (input.status) {
      query.andWhere("processing.status = :status", {
        status: input.status,
      });
    }
    return query.getMany();
  }

  /** Record마다 가장 최근에 저장된 서버 판정 결과를 조회합니다. */
  listRecordEvaluations(recordIds: string[]) {
    if (recordIds.length === 0) return Promise.resolve([]);
    return AppDataSource.getRepository(IssueEvaluationEntity)
      .createQueryBuilder("evaluation")
      .distinctOn(["evaluation.recordId"])
      .where('evaluation."recordId" IN (:...recordIds)', { recordIds })
      .orderBy('evaluation."recordId"', "ASC")
      .addOrderBy("evaluation.createdAt", "DESC")
      .addOrderBy("evaluation.id", "DESC")
      .getMany();
  }

  /** Issue Record 처리 파이프라인의 첫 화면용 상태 수치를 집계합니다. */
  async getRecordProcessingSummary(
    workspaceId: string,
  ): Promise<IssueRecordProcessingSummaryRow> {
    const rows = (await AppDataSource.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE processing.status = 'RECEIVED')::text AS "received",
          COUNT(*) FILTER (WHERE processing.status = 'EVALUATING')::text AS "evaluating",
          COUNT(*) FILTER (WHERE processing.status = 'DECIDED')::text AS "decided",
          COUNT(*) FILTER (WHERE processing.status = 'FAILED')::text AS "failed",
          COUNT(*) FILTER (
            WHERE record."recordKind" = 'RECOVERY'
              AND processing.status <> 'DECIDED'
          )::text AS "recoveryPending",
          COUNT(*) FILTER (
            WHERE processing."nextEvaluationAt" IS NOT NULL
          )::text AS "deferred",
          COUNT(*) FILTER (
            WHERE processing.status <> 'DECIDED'
              AND processing."updatedAt" < now() - interval '5 minutes'
              AND (
                processing."nextEvaluationAt" IS NULL
                OR processing."nextEvaluationAt" <= now()
              )
          )::text AS "delayed",
          COUNT(*) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM "issue_evaluation" evaluation
              WHERE evaluation."recordId" = record.id
                AND evaluation."reasonCode" = 'UNSUPPORTED_DETECTION_TYPE'
            )
          )::text AS "unsupported"
        FROM "issue_record_processing" processing
        INNER JOIN "issue_record" record ON record.id = processing."recordId"
        WHERE record."workspaceId" = $1
      `,
      [workspaceId],
    )) as IssueRecordProcessingSummaryRow[];

    return (
      rows[0] ?? {
        received: "0",
        evaluating: "0",
        decided: "0",
        failed: "0",
        recoveryPending: "0",
        deferred: "0",
        delayed: "0",
        unsupported: "0",
      }
    );
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
        lock: { mode: "pessimistic_write" },
      });
      if (!issue) throw new Error("ISSUE_NOT_FOUND");
      if (!canTransitionIssueStatus(issue.status, input.status)) {
        throw new Error("INVALID_ISSUE_STATUS_TRANSITION");
      }
      if (issue.status === input.status) {
        issue.resolvedByUser = issue.resolvedByUserId
          ? await manager
              .getRepository(UserEntity)
              .findOneBy({ id: issue.resolvedByUserId })
          : null;
        return issue;
      }

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
        type:
          input.status === ISSUE_STATUS.OPEN &&
          (previousStatus === ISSUE_STATUS.RESOLVED ||
            previousStatus === ISSUE_STATUS.IGNORED)
            ? ISSUE_ACTIVITY_TYPE.REOPENED
            : ISSUE_ACTIVITY_TYPE.STATUS_CHANGED,
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

  /** 조직 역할을 담당자 FK에 필요한 워크스페이스 역할로 변환합니다. */
  private toWorkspaceRole(role: UserPermissions): WorkspacePermissions {
    if (role === USER_PERMISSIONS.VIEWER) {
      return WORKSPACE_PERMISSIONS.VIEWER;
    }
    if (role === USER_PERMISSIONS.MEMBER) {
      return WORKSPACE_PERMISSIONS.MEMBER;
    }
    return WORKSPACE_PERMISSIONS.ADMIN;
  }

  /** 멘션 대상이 같은 조직의 사용자일 때만 사용자 정보를 반환합니다. */
  private async resolveMentionUsers(
    manager: EntityManager,
    workspaceId: string,
    userIds: string[],
  ): Promise<UserEntity[]> {
    if (userIds.length === 0) return [];

    const memberships = await manager
      .getRepository(OrganizationUserEntity)
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.user", "user")
      .innerJoin("membership.organization", "organization")
      .innerJoin("organization.workspaces", "workspace")
      .where("workspace.id = :workspaceId", { workspaceId })
      .andWhere("user.id IN (:...userIds)", { userIds })
      .getMany();
    if (memberships.length !== userIds.length) {
      throw new Error("ISSUE_MENTION_NOT_MEMBER");
    }

    const userById = new Map(
      memberships.map((membership) => [membership.user.id, membership.user]),
    );
    return userIds.map((userId) => userById.get(userId)!);
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
