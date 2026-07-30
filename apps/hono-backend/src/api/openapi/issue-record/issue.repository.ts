import {
  ISSUE_ACTOR_TYPE,
  ISSUE_ACTIVITY_TYPE,
  ISSUE_FINGERPRINT_VERSION,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  type IssueSeverity,
} from "@repo/constants";
import {
  IssueActivityEntity,
  IssueEntity,
  IssueOccurrenceEntity,
  PromptVersionEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../../provider/database/typeorm-config.js";

export interface PersistIssueInput {
  workspaceId: string;
  stableFingerprint: string;
  exactFingerprint: string;
  title: string;
  summary: string;
  message?: {
    titleKey: string;
    summaryKey: string;
    params: Record<string, unknown>;
  };
  category: IssueEntity["category"];
  severity: IssueEntity["severity"];
  source: IssueEntity["source"];
  environment: string;
  agentId: string;
  policyId?: string;
  promptVersionId?: string;
  sessionId: string;
  eventId?: string;
  firewallViolationId?: string;
  isBlocked: boolean;
  detectedAt: Date;
  evidence?: Record<string, unknown>;
  detectorVersion: string;
  clientOccurrenceId: string;
  recordId?: string;
  evaluationId?: string;
  reporter: {
    type: IssueEntity["reporterType"];
    userId?: string;
    name: string;
  };
  riskSignals: string[];
  reproductionSteps: string[];
  tags: string[];
}

export interface PersistIssueResult {
  issue: IssueEntity;
  occurrence: IssueOccurrenceEntity;
  isNewIssue: boolean;
  isNewOccurrence: boolean;
  isReopened: boolean;
}

export interface RecoverIssueInput {
  workspaceId: string;
  environment: string;
  agentId: string;
  policyId?: string;
  promptVersionId?: string;
  detectionType: string;
  toolName?: string;
  detectedAt: Date;
  recordId: string;
  reporterName: string;
  healthyObservationCount?: number;
}

export class IssueRepository {
  findPromptVersion(workspaceId: string, promptVersionId: string) {
    return AppDataSource.getRepository(PromptVersionEntity).findOne({
      where: {
        id: promptVersionId,
        workspace: { id: workspaceId },
      },
    });
  }

  record(input: PersistIssueInput): Promise<PersistIssueResult> {
    return AppDataSource.transaction((manager) =>
      this.recordInTransaction(manager, input),
    );
  }

  /** 충분한 정상 실행 근거가 도착하면 가장 최근의 동일 이슈를 해결 처리합니다. */
  recover(input: RecoverIssueInput): Promise<IssueEntity | null> {
    return AppDataSource.transaction(async (manager) => {
      const query = manager
        .getRepository(IssueEntity)
        .createQueryBuilder("issue")
        .where("issue.workspaceId = :workspaceId", {
          workspaceId: input.workspaceId,
        })
        .andWhere("issue.environment = :environment", {
          environment: input.environment,
        })
        .andWhere("issue.agentId = :agentId", { agentId: input.agentId })
        .andWhere("issue.status IN (:...statuses)", {
          statuses: [ISSUE_STATUS.OPEN, ISSUE_STATUS.INVESTIGATING],
        })
        .andWhere(":detectionType = ANY(issue.tags)", {
          detectionType: input.detectionType,
        });
      if (input.policyId) {
        query.andWhere("issue.policyId = :policyId", {
          policyId: input.policyId,
        });
      } else {
        query.andWhere("issue.policyId IS NULL");
      }
      if (input.promptVersionId) {
        query.andWhere(
          "issue.representativePromptVersionId = :promptVersionId",
          { promptVersionId: input.promptVersionId },
        );
      }
      if (input.toolName) {
        query.andWhere(
          `EXISTS (
            SELECT 1
            FROM issue_occurrence occurrence
            WHERE occurrence."issueId" = issue.id
              AND occurrence.evidence -> 'recordPayload' ->> 'toolName' = :toolName
          )`,
          { toolName: input.toolName },
        );
      }
      const issue = await query
        .orderBy("issue.lastSeenAt", "DESC")
        .addOrderBy("issue.id", "DESC")
        .setLock("pessimistic_write")
        .getOne();
      if (!issue) return null;

      const previousStatus = issue.status;
      issue.status = ISSUE_STATUS.RESOLVED;
      issue.resolvedAt = input.detectedAt;
      issue.resolvedByUserId = null;
      await manager.getRepository(IssueEntity).save(issue);
      const activityRepository = manager.getRepository(IssueActivityEntity);
      await activityRepository.save(
        activityRepository.create({
          workspaceId: input.workspaceId,
          issueId: issue.id,
          type: ISSUE_ACTIVITY_TYPE.STATUS_CHANGED,
          actorType: ISSUE_ACTOR_TYPE.SDK,
          actorUserId: null,
          actorName: input.reporterName,
          body: null,
          metadata: {
            from: previousStatus,
            to: ISSUE_STATUS.RESOLVED,
            recoveryRecordId: input.recordId,
            healthyObservationCount: input.healthyObservationCount,
          },
        }),
      );
      return issue;
    });
  }

  private async recordInTransaction(
    manager: EntityManager,
    input: PersistIssueInput,
  ): Promise<PersistIssueResult> {
    await this.lockOccurrenceKey(manager, input);

    const occurrenceRepository = manager.getRepository(IssueOccurrenceEntity);
    const existingOccurrence = await occurrenceRepository.findOne({
      where: {
        workspaceId: input.workspaceId,
        clientOccurrenceId: input.clientOccurrenceId,
      },
      relations: { issue: true },
    });
    if (existingOccurrence) {
      return {
        issue: existingOccurrence.issue,
        occurrence: existingOccurrence,
        isNewIssue: false,
        isNewOccurrence: false,
        isReopened: false,
      };
    }

    const issueRepository = manager.getRepository(IssueEntity);
    const insertResult = await issueRepository
      .createQueryBuilder()
      .insert()
      .values({
        workspaceId: input.workspaceId,
        stableFingerprint: input.stableFingerprint,
        stableFingerprintVersion: ISSUE_FINGERPRINT_VERSION.V1,
        exactFingerprint: input.exactFingerprint,
        exactFingerprintVersion: ISSUE_FINGERPRINT_VERSION.V1,
        title: input.title,
        summary: input.summary,
        titleKey: input.message?.titleKey ?? null,
        summaryKey: input.message?.summaryKey ?? null,
        messageParams: () => ":messageParams",
        category: input.category,
        severity: input.severity,
        status: ISSUE_STATUS.OPEN,
        source: input.source,
        environment: input.environment,
        agentId: input.agentId,
        policyId: input.policyId ?? null,
        representativePromptVersionId: input.promptVersionId ?? null,
        representativeOccurrenceId: null,
        reporterType: input.reporter.type,
        reporterUserId: input.reporter.userId ?? null,
        reporterName: input.reporter.name,
        firstSeenAt: input.detectedAt,
        lastSeenAt: input.detectedAt,
        occurrenceCount: 0,
        affectedSessionCount: 0,
        blockedOccurrenceCount: 0,
        riskSignals: input.riskSignals,
        reproductionSteps: input.reproductionSteps,
        tags: input.tags,
        resolvedAt: null,
        resolvedByUserId: null,
      })
      .setParameter("messageParams", input.message?.params ?? null)
      .orIgnore()
      .returning(["id"])
      .execute();

    const insertedIssueId = this.readInsertedId(insertResult.raw);
    const issue = await issueRepository.findOne({
      where: insertedIssueId
        ? { id: insertedIssueId }
        : {
            workspaceId: input.workspaceId,
            exactFingerprintVersion: ISSUE_FINGERPRINT_VERSION.V1,
            exactFingerprint: input.exactFingerprint,
          },
      lock: { mode: "pessimistic_write" },
    });
    if (!issue) {
      throw new Error("ISSUE_UPSERT_FAILED");
    }

    const isNewIssue = insertedIssueId !== null;
    const isReopened =
      !isNewIssue &&
      (issue.status === ISSUE_STATUS.RESOLVED ||
        issue.status === ISSUE_STATUS.IGNORED);
    const hasAffectedSession = await occurrenceRepository.existsBy({
      issueId: issue.id,
      sessionId: input.sessionId,
    });

    const occurrence = await occurrenceRepository.save(
      occurrenceRepository.create({
        workspaceId: input.workspaceId,
        issueId: issue.id,
        sessionId: input.sessionId,
        eventId: input.eventId ?? null,
        firewallViolationId: input.firewallViolationId ?? null,
        agentId: input.agentId,
        policyId: input.policyId ?? null,
        promptVersionId: input.promptVersionId ?? null,
        environment: input.environment,
        isBlocked: input.isBlocked,
        detectedAt: input.detectedAt,
        evidence: input.evidence ?? null,
        detectorVersion: input.detectorVersion,
        clientOccurrenceId: input.clientOccurrenceId,
        recordId: input.recordId ?? null,
        evaluationId: input.evaluationId ?? null,
      }),
    );

    issue.status = isReopened ? ISSUE_STATUS.OPEN : issue.status;
    issue.resolvedAt = isReopened ? null : issue.resolvedAt;
    issue.resolvedByUserId = isReopened ? null : issue.resolvedByUserId;
    issue.severity = this.maxSeverity(issue.severity, input.severity);
    issue.lastSeenAt =
      issue.lastSeenAt > input.detectedAt ? issue.lastSeenAt : input.detectedAt;
    issue.occurrenceCount += 1;
    issue.affectedSessionCount += hasAffectedSession ? 0 : 1;
    issue.blockedOccurrenceCount += input.isBlocked ? 1 : 0;
    issue.representativeOccurrenceId ??= occurrence.id;
    await issueRepository.save(issue);

    if (isNewIssue || isReopened) {
      await this.createActivity(
        manager,
        issue,
        isNewIssue ? ISSUE_ACTIVITY_TYPE.CREATED : ISSUE_ACTIVITY_TYPE.REOPENED,
        input,
        occurrence.id,
      );
    }

    return {
      issue,
      occurrence,
      isNewIssue,
      isNewOccurrence: true,
      isReopened,
    };
  }

  private lockOccurrenceKey(
    manager: EntityManager,
    input: PersistIssueInput,
  ): Promise<unknown> {
    return manager.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`${input.workspaceId}:${input.clientOccurrenceId}`],
    );
  }

  private async createActivity(
    manager: EntityManager,
    issue: IssueEntity,
    type: IssueActivityEntity["type"],
    input: PersistIssueInput,
    occurrenceId: string,
  ): Promise<void> {
    const repository = manager.getRepository(IssueActivityEntity);
    await repository.save(
      repository.create({
        workspaceId: input.workspaceId,
        issueId: issue.id,
        type,
        actorType: input.reporter.type,
        actorUserId: input.reporter.userId ?? null,
        actorName: input.reporter.name,
        body: null,
        metadata: {
          occurrenceId,
          stableFingerprint: input.stableFingerprint,
          exactFingerprint: input.exactFingerprint,
        },
      }),
    );
  }

  private readInsertedId(raw: unknown): string | null {
    if (!Array.isArray(raw)) return null;
    const first = raw[0] as { id?: unknown } | undefined;
    return typeof first?.id === "string" ? first.id : null;
  }

  private maxSeverity(
    current: IssueSeverity,
    incoming: IssueSeverity,
  ): IssueSeverity {
    const rank: Record<IssueSeverity, number> = {
      [ISSUE_SEVERITY.INFO]: 0,
      [ISSUE_SEVERITY.WARNING]: 1,
      [ISSUE_SEVERITY.CRITICAL]: 2,
    };
    return rank[incoming] > rank[current] ? incoming : current;
  }
}

export const issueRepository = new IssueRepository();
