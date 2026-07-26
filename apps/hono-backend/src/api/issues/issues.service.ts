import type {
  GetIssueEvaluationsQueryDto,
  GetIssueEvaluationsResponseDto,
  GetIssueOccurrencesQueryDto,
  GetIssueOccurrencesResponseDto,
  GetIssueResponseDto,
  GetIssuesQueryDto,
  GetIssuesResponseDto,
  GetIssuesSummaryQueryDto,
  GetIssuesSummaryResponseDto,
  UpdateIssueStatusDto,
  UpdateIssueStatusResponseDto,
} from "@repo/dto";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
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
  }): Promise<GetIssuesResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    const rows = await this.repository.list(input.workspaceId, input.query);
    const hasMore = rows.length > input.query.limit;
    const page = rows.slice(0, input.query.limit);
    const last = page.at(-1);

    return {
      items: page.map((issue) => ({
        id: issue.id,
        title: issue.title,
        summary: issue.summary,
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
        firstSeenAt: issue.firstSeenAt.toISOString(),
        lastSeenAt: issue.lastSeenAt.toISOString(),
      })),
      nextCursor:
        hasMore && last ? `${last.lastSeenAt.toISOString()}|${last.id}` : null,
    };
  }

  /** 이슈의 대표 Agent, 정책, 프롬프트 버전과 집계값을 반환합니다. */
  async getIssue(input: {
    userId: string;
    workspaceId: string;
    issueId: string;
  }): Promise<GetIssueResponseDto> {
    await this.assertReadAccess(input.userId, input.workspaceId);
    const issue = await this.findIssueOrThrow(input.workspaceId, input.issueId);
    return {
      id: issue.id,
      title: issue.title,
      summary: issue.summary,
      category: issue.category,
      severity: issue.severity,
      status: issue.status,
      source: issue.source,
      environment: issue.environment,
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

  private async findIssueOrThrow(workspaceId: string, issueId: string) {
    const issue = await this.repository.findIssue(workspaceId, issueId);
    if (!issue) throw new NotFoundErrorException("ISSUE_NOT_FOUND");
    return issue;
  }

  private number(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

export const issuesService = new IssuesService();
