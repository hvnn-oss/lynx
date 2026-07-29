import type {
  CreateIssueCommentDto,
  CreateIssueCommentResponseDto,
  GetIssueActivitiesQueryDto,
  GetIssueActivitiesResponseDto,
  GetIssueAssigneesResponseDto,
  GetIssueEvaluationsQueryDto,
  GetIssueEvaluationsResponseDto,
  GetIssueOccurrencesQueryDto,
  GetIssueOccurrencesResponseDto,
  GetIssueRecordsQueryDto,
  GetIssueRecordsResponseDto,
  GetIssueResponseDto,
  GetIssuesQueryDto,
  GetIssuesResponseDto,
  GetIssuesSummaryQueryDto,
  GetIssuesSummaryResponseDto,
  UpdateIssueStatusDto,
  UpdateIssueStatusResponseDto,
  UpdateIssueAssigneesDto,
  UpdateIssueCommentDto,
  UpdateIssueCommentResponseDto,
} from "@repo/dto";
import type { IssueActivityEntity } from "@repo/database";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import { ForbiddenErrorException } from "../../common/exceptions/forbidden.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import {
  renderIssueMessage,
  type IssueLocale,
} from "../../common/services/issue-message.service.js";
import { IssuesRepository, issuesRepository } from "./issues.repository.js";

/** 이슈 API 권한을 확인하고 저장 모델을 공개 응답으로 변환합니다. */
export class IssuesService {
  constructor(
    private readonly repository: IssuesRepository = issuesRepository,
    private readonly accessControl: AccessControlService = accessControlService,
  ) {}

  /** 접근 가능한 워크스페이스의 필터링된 이슈 페이지를 반환합니다. */
  async getIssues(input: {
    userId: string;
    workspaceId: string;
    query: GetIssuesQueryDto;
    locale?: IssueLocale;
  }): Promise<GetIssuesResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    const rows = await this.repository.list(input.workspaceId, input.query);
    const hasMore = rows.length > input.query.limit;
    const page = rows.slice(0, input.query.limit);
    const last = page.at(-1);

    return {
      items: page.map((issue) => {
        const message = this.readIssueMessage(issue);
        const rendered = renderIssueMessage(message, input.locale ?? "en", {
          title: issue.title,
          summary: issue.summary,
        });
        return {
          id: issue.id,
          title: rendered.title,
          summary: rendered.summary,
          message,
          category: issue.category,
          severity: issue.severity,
          status: issue.status,
          environment: issue.environment,
          agent: issue.agent
            ? { id: issue.agent.id, name: issue.agent.name }
            : null,
          occurrenceCount: issue.occurrenceCount,
          affectedSessionCount: issue.affectedSessionCount,
          blockedOccurrenceCount: issue.blockedOccurrenceCount,
          fingerprint: issue.stableFingerprint,
          firstSeenAt: issue.firstSeenAt.toISOString(),
          lastSeenAt: issue.lastSeenAt.toISOString(),
        };
      }),
      nextCursor:
        hasMore && last ? `${last.lastSeenAt.toISOString()}|${last.id}` : null,
    };
  }

  /** 이슈의 대표 Agent, 정책, 프롬프트 버전과 집계값을 반환합니다. */
  async getIssue(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    locale?: IssueLocale;
  }): Promise<GetIssueResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    const issue = await this.findIssueOrThrow(input.workspaceId, input.issueId);
    const message = this.readIssueMessage(issue);
    const rendered = renderIssueMessage(message, input.locale ?? "en", {
      title: issue.title,
      summary: issue.summary,
    });
    return {
      id: issue.id,
      title: rendered.title,
      summary: rendered.summary,
      message,
      category: issue.category,
      severity: issue.severity,
      status: issue.status,
      source: issue.source,
      environment: issue.environment,
      reporter: {
        type: issue.reporterType,
        name: issue.reporterName,
      },
      agent: issue.agent
        ? { id: issue.agent.id, name: issue.agent.name }
        : null,
      policy: issue.policy
        ? {
            id: String(issue.policy.id),
            name: issue.policy.name,
            version: issue.policy.version,
          }
        : null,
      promptVersion: issue.representativePromptVersion
        ? {
            id: issue.representativePromptVersion.id,
            version: issue.representativePromptVersion.version,
          }
        : null,
      fingerprint: {
        stable: issue.stableFingerprint,
        exact: issue.exactFingerprint,
        version: issue.exactFingerprintVersion,
      },
      counts: {
        occurrences: issue.occurrenceCount,
        affectedSessions: issue.affectedSessionCount,
        blockedOccurrences: issue.blockedOccurrenceCount,
      },
      riskSignals: issue.riskSignals,
      reproductionSteps: issue.reproductionSteps,
      tags: issue.tags,
      firstSeenAt: issue.firstSeenAt.toISOString(),
      lastSeenAt: issue.lastSeenAt.toISOString(),
      resolvedAt: issue.resolvedAt?.toISOString() ?? null,
    };
  }

  /** 이슈가 발생한 실행 컨텍스트를 최근순으로 반환합니다. */
  async getOccurrences(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    query: GetIssueOccurrencesQueryDto;
  }): Promise<GetIssueOccurrencesResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    await this.findIssueOrThrow(input.workspaceId, input.issueId);
    const rows = await this.repository.listOccurrences(
      input.workspaceId,
      input.issueId,
      input.query,
    );
    const hasMore = rows.length > input.query.limit;
    const page = rows.slice(0, input.query.limit);
    const last = page.at(-1);
    return {
      items: page.map((occurrence) => ({
        id: occurrence.id,
        detectedAt: occurrence.detectedAt.toISOString(),
        environment: occurrence.environment,
        isBlocked: occurrence.isBlocked,
        session: {
          id: occurrence.session.id,
          sessionId: occurrence.session.clientSessionId ?? null,
        },
        run: occurrence.event?.run
          ? {
              id: occurrence.event.run.id,
              runId: occurrence.event.run.clientRunId,
            }
          : null,
        event: occurrence.event
          ? {
              id: occurrence.event.id,
              eventId: occurrence.event.clientEventId ?? null,
              eventType: occurrence.event.eventType,
              label: occurrence.event.label,
            }
          : null,
        agent: occurrence.agent
          ? { id: occurrence.agent.id, name: occurrence.agent.name }
          : null,
        policy: occurrence.policy
          ? {
              id: String(occurrence.policy.id),
              name: occurrence.policy.name,
              version: occurrence.policy.version,
            }
          : null,
        promptVersion: occurrence.promptVersion
          ? {
              id: occurrence.promptVersion.id,
              version: occurrence.promptVersion.version,
            }
          : null,
        detectorVersion: occurrence.detectorVersion,
        evidence: occurrence.evidence,
      })),
      nextCursor:
        hasMore && last ? `${last.detectedAt.toISOString()}|${last.id}` : null,
    };
  }

  /** 이슈를 생성하거나 연결한 서버 평가 내역을 최근순으로 반환합니다. */
  async getEvaluations(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    query: GetIssueEvaluationsQueryDto;
  }): Promise<GetIssueEvaluationsResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    await this.findIssueOrThrow(input.workspaceId, input.issueId);
    const rows = await this.repository.listEvaluations(
      input.workspaceId,
      input.issueId,
      input.query,
    );
    const hasMore = rows.length > input.query.limit;
    const page = rows.slice(0, input.query.limit);
    const last = page.at(-1);
    return {
      items: page.map((evaluation) => ({
        id: evaluation.id,
        recordId: evaluation.recordId,
        pipeline: evaluation.pipeline,
        action: evaluation.action,
        reasonCode: evaluation.reasonCode,
        summary: evaluation.summary,
        confidence: evaluation.confidence,
        matchedIssueId: evaluation.matchedIssueId,
        evaluator: {
          name: evaluation.evaluatorName,
          version: evaluation.evaluatorVersion,
          ruleSetVersion: evaluation.ruleSetVersion,
        },
        fingerprint:
          evaluation.stableFingerprint && evaluation.exactFingerprint
            ? {
                stable: evaluation.stableFingerprint,
                exact: evaluation.exactFingerprint,
                version:
                  evaluation.exactFingerprintVersion ??
                  evaluation.stableFingerprintVersion ??
                  "v1",
              }
            : null,
        evidence: evaluation.evidence,
        createdAt: evaluation.createdAt.toISOString(),
      })),
      nextCursor:
        hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  /** 댓글과 상태·담당자 변경을 하나의 Activity 타임라인으로 반환합니다. */
  async getActivities(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    query: GetIssueActivitiesQueryDto;
  }): Promise<GetIssueActivitiesResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    await this.findIssueOrThrow(input.workspaceId, input.issueId);
    const rows = await this.repository.listActivities(
      input.workspaceId,
      input.issueId,
      input.query,
    );
    const hasMore = rows.length > input.query.limit;
    const page = rows.slice(0, input.query.limit);
    const last = page.at(-1);
    return {
      items: page.map((activity) => this.mapActivity(activity, input.userId)),
      nextCursor:
        hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  /** 권한을 확인하고 사용자 댓글을 Activity로 저장합니다. */
  async createComment(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    body: CreateIssueCommentDto;
  }): Promise<CreateIssueCommentResponseDto> {
    await this.assertUpdateAccess(input.userId, input.workspaceId);
    try {
      const activity = await this.repository.createComment({
        userId: input.userId,
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        body: input.body.body,
        mentionedUserIds: input.body.mentionedUserIds,
      });
      return this.mapActivity(activity, input.userId);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  /** 작성자가 자신의 댓글 본문과 멘션 대상을 수정합니다. */
  async updateComment(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    commentId: string;
    body: UpdateIssueCommentDto;
  }): Promise<UpdateIssueCommentResponseDto> {
    await this.assertUpdateAccess(input.userId, input.workspaceId);
    try {
      const activity = await this.repository.updateComment({
        userId: input.userId,
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        commentId: input.commentId,
        body: input.body.body,
        mentionedUserIds: input.body.mentionedUserIds,
      });
      return this.mapActivity(activity, input.userId);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  /** 작성자가 자신의 댓글을 Activity 이력은 보존한 채 삭제합니다. */
  async deleteComment(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    commentId: string;
  }): Promise<UpdateIssueCommentResponseDto> {
    await this.assertUpdateAccess(input.userId, input.workspaceId);
    try {
      const activity = await this.repository.deleteComment(input);
      return this.mapActivity(activity, input.userId);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  /** 현재 담당자와 선택 가능한 조직 멤버를 반환합니다. */
  async getAssignees(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
  }): Promise<GetIssueAssigneesResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    await this.findIssueOrThrow(input.workspaceId, input.issueId);
    return this.readAssignees(input.workspaceId, input.issueId);
  }

  /** 담당자 목록을 교체하고 변경 Activity를 기록합니다. */
  async updateAssignees(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    body: UpdateIssueAssigneesDto;
  }): Promise<GetIssueAssigneesResponseDto> {
    await this.assertUpdateAccess(input.userId, input.workspaceId);
    try {
      await this.repository.updateAssignees({
        userId: input.userId,
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        assigneeUserIds: input.body.userIds,
      });
      return this.readAssignees(input.workspaceId, input.issueId);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  /** SDK record의 접수·평가·실패 상태와 최근 서버 판정을 반환합니다. */
  async getIssueRecords(input: {
    userId: string;
    workspaceId: string;
    query: GetIssueRecordsQueryDto;
  }): Promise<GetIssueRecordsResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    const [rows, summary] = await Promise.all([
      this.repository.listRecordProcessing(input.workspaceId, input.query),
      this.repository.getRecordProcessingSummary(input.workspaceId),
    ]);
    const hasMore = rows.length > input.query.limit;
    const page = rows.slice(0, input.query.limit);
    const last = page.at(-1);
    const evaluations = await this.repository.listRecordEvaluations(
      page.map((row) => row.recordId),
    );
    const latestEvaluationByRecord = new Map<
      string,
      (typeof evaluations)[number]
    >();
    for (const evaluation of evaluations) {
      if (!latestEvaluationByRecord.has(evaluation.recordId)) {
        latestEvaluationByRecord.set(evaluation.recordId, evaluation);
      }
    }
    const now = Date.now();
    const delayedBefore = now - 5 * 60_000;

    return {
      summary: {
        received: this.number(summary.received),
        evaluating: this.number(summary.evaluating),
        decided: this.number(summary.decided),
        failed: this.number(summary.failed),
        recoveryPending: this.number(summary.recoveryPending),
        deferred: this.number(summary.deferred),
        delayed: this.number(summary.delayed),
        unsupported: this.number(summary.unsupported),
      },
      items: page.map((processing) => {
        const record = processing.record;
        const evaluation = latestEvaluationByRecord.get(record.id);
        const nextEvaluationAt = processing.nextEvaluationAt?.getTime() ?? null;
        const isDelayed =
          processing.status !== "DECIDED" &&
          processing.updatedAt.getTime() < delayedBefore &&
          (nextEvaluationAt === null || nextEvaluationAt <= now);

        return {
          id: record.id,
          recordKind: record.recordKind,
          detectionType: record.detectionType,
          sdkInstanceId: record.sdkInstanceId,
          clientAgentId: record.clientAgentId,
          clientRunId: record.clientRunId,
          clientSessionId: record.clientSessionId,
          environment: record.environment,
          detectedAt: record.detectedAt.toISOString(),
          createdAt: record.createdAt.toISOString(),
          processing: {
            status: processing.status,
            attemptCount: processing.attemptCount,
            lastErrorCode: processing.lastErrorCode,
            nextEvaluationAt:
              processing.nextEvaluationAt?.toISOString() ?? null,
            updatedAt: processing.updatedAt.toISOString(),
            isDelayed,
          },
          decision: evaluation
            ? {
                action: evaluation.action,
                reasonCode: evaluation.reasonCode,
                summary: evaluation.summary,
                confidence: evaluation.confidence,
                matchedIssueId: evaluation.matchedIssueId,
                createdAt: evaluation.createdAt.toISOString(),
              }
            : null,
        };
      }),
      nextCursor:
        hasMore && last
          ? `${last.record.detectedAt.toISOString()}|${last.record.id}`
          : null,
    };
  }

  /** 대시보드에 필요한 이슈와 발생 건 집계를 반환합니다. */
  async getSummary(input: {
    userId: string;
    workspaceId: string;
    query: GetIssuesSummaryQueryDto;
  }): Promise<GetIssuesSummaryResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    const result = await this.repository.getSummary(
      input.workspaceId,
      input.query,
    );
    return {
      total: this.number(result.issues.total),
      byStatus: {
        open: this.number(result.issues.open),
        investigating: this.number(result.issues.investigating),
        resolved: this.number(result.issues.resolved),
        ignored: this.number(result.issues.ignored),
      },
      bySeverity: {
        critical: this.number(result.issues.critical),
        warning: this.number(result.issues.warning),
        info: this.number(result.issues.info),
      },
      newIssues: this.number(result.issues.newIssues),
      reopenedIssues: this.number(result.reopenedIssues),
      occurrences: this.number(result.occurrences.occurrences),
      blockedOccurrences: this.number(result.occurrences.blockedOccurrences),
      affectedSessions: this.number(result.occurrences.affectedSessions),
    };
  }

  /** 이슈 상태를 변경하고 해결 사용자와 상태 변경 Activity를 기록합니다. */
  async updateStatus(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
    body: UpdateIssueStatusDto;
  }): Promise<UpdateIssueStatusResponseDto> {
    await this.accessControl.assertWorkspaceCapability({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_UPDATE,
    });
    try {
      const issue = await this.repository.updateStatus({
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        userId: input.userId,
        status: input.body.status,
        reason: input.body.reason,
      });
      return {
        id: issue.id,
        status: issue.status,
        resolvedAt: issue.resolvedAt?.toISOString() ?? null,
        resolvedBy: issue.resolvedByUser
          ? {
              id: issue.resolvedByUser.id,
              name: issue.resolvedByUser.name,
            }
          : null,
        updatedAt: issue.updatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "ISSUE_NOT_FOUND") {
        throw new NotFoundErrorException("ISSUE_NOT_FOUND");
      }
      if (
        error instanceof Error &&
        error.message === "INVALID_ISSUE_STATUS_TRANSITION"
      ) {
        throw new BadRequestErrorException("INVALID_ISSUE_STATUS_TRANSITION");
      }
      throw error;
    }
  }

  private assertReadAccess(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
  }

  private assertUpdateAccess(userId: string, workspaceId: string) {
    return this.accessControl.assertWorkspaceCapability({
      userId,
      workspaceId,
      capability: CAPABILITIES.WORKSPACE_UPDATE,
    });
  }

  private mapActivity(
    activity: IssueActivityEntity,
    currentUserId: string,
  ): GetIssueActivitiesResponseDto["items"][number] {
    const isCommentAuthor =
      activity.type === "COMMENTED" &&
      activity.actorUserId === currentUserId &&
      (activity.deletedAt ?? null) === null;
    return {
      id: activity.id,
      type: activity.type,
      actor: {
        type: activity.actorType,
        userId: activity.actorUserId,
        name: activity.actorName,
      },
      body: activity.body,
      editedAt: activity.editedAt?.toISOString() ?? null,
      deletedAt: activity.deletedAt?.toISOString() ?? null,
      mentions: this.readActivityMentions(activity.metadata),
      permissions: {
        canEdit: isCommentAuthor,
        canDelete: isCommentAuthor,
      },
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString(),
    };
  }

  private async readAssignees(
    workspaceId: string,
    issueId: string,
  ): Promise<GetIssueAssigneesResponseDto> {
    const result = await this.repository.getAssignees(workspaceId, issueId);
    const availableUsers = result.availableUsers.map((membership) => ({
      userId: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
    }));
    const availableByUserId = new Map(
      availableUsers.map((user) => [user.userId, user]),
    );
    return {
      assignees: result.assignees
        .map((assignee) => availableByUserId.get(assignee.userId))
        .filter((user) => user !== undefined),
      availableUsers,
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (error instanceof Error && error.message === "ISSUE_NOT_FOUND") {
      throw new NotFoundErrorException("ISSUE_NOT_FOUND");
    }
    if (
      error instanceof Error &&
      error.message === "ISSUE_ASSIGNEE_NOT_MEMBER"
    ) {
      throw new BadRequestErrorException("ISSUE_ASSIGNEE_NOT_MEMBER");
    }
    if (
      error instanceof Error &&
      error.message === "ISSUE_MENTION_NOT_MEMBER"
    ) {
      throw new BadRequestErrorException("ISSUE_MENTION_NOT_MEMBER");
    }
    if (
      error instanceof Error &&
      (error.message === "ISSUE_COMMENT_NOT_FOUND" ||
        error.message === "ISSUE_COMMENT_DELETED")
    ) {
      throw new NotFoundErrorException(error.message);
    }
    if (error instanceof Error && error.message === "ISSUE_COMMENT_FORBIDDEN") {
      throw new ForbiddenErrorException("ISSUE_COMMENT_FORBIDDEN");
    }
    throw error;
  }

  private readActivityMentions(
    metadata: Record<string, unknown> | null,
  ): Array<{ userId: string; name: string }> {
    const mentions = metadata?.mentions;
    if (!Array.isArray(mentions)) return [];
    return mentions.flatMap((mention) => {
      if (!mention || typeof mention !== "object") return [];
      const candidate = mention as Record<string, unknown>;
      return typeof candidate.userId === "string" &&
        typeof candidate.name === "string"
        ? [{ userId: candidate.userId, name: candidate.name }]
        : [];
    });
  }

  private async findIssueOrThrow(workspaceId: string, issueId: string) {
    const issue = await this.repository.findIssue(workspaceId, issueId);
    if (!issue) throw new NotFoundErrorException("ISSUE_NOT_FOUND");
    return issue;
  }

  private number(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /** 저장된 메시지 키가 완전할 때만 다국어 렌더링 입력으로 사용합니다. */
  private readIssueMessage(issue: {
    titleKey: string | null;
    summaryKey: string | null;
    messageParams: Record<string, unknown> | null;
  }) {
    return issue.titleKey && issue.summaryKey
      ? {
          titleKey: issue.titleKey,
          summaryKey: issue.summaryKey,
          params: issue.messageParams ?? {},
        }
      : null;
  }
}

export const issuesService = new IssuesService();
