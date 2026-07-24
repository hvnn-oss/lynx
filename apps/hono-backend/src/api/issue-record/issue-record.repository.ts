import {
  AgentEntity,
  EventEntity,
  IssueEvaluationEntity,
  IssueRecordEntity,
  IssueRecordProcessingEntity,
  SessionEntity,
} from "@repo/database";
import { ISSUE_RECORD_STATUS } from "@repo/constants";
import type { EntityManager } from "typeorm";
import type {
  IssueRecordDetectionDecision,
  StoreIssueRecordInput,
} from "../../common/types/issue.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 저장된 원본 record와 처리 상태 및 멱등성 결과입니다. */
export interface StoredIssueRecord {
  /** 변경하지 않고 보존되는 SDK 원본 record입니다. */
  record: IssueRecordEntity;
  /** 후속 평가 작업이 갱신할 처리 상태입니다. */
  processing: IssueRecordProcessingEntity;
  /** 이번 요청에서 새로 생성되었는지 나타냅니다. */
  isNew: boolean;
}

/** worker가 독점적으로 평가할 record와 현재 처리 상태입니다. */
export interface ClaimedIssueRecord {
  record: IssueRecordEntity;
  processing: IssueRecordProcessingEntity;
}

/** 외부 SDK 식별자를 서버 저장 모델로 확인한 평가 context입니다. */
export interface IssueRecordContext {
  session: SessionEntity | null;
  agent: AgentEntity | null;
  event: EventEntity | null;
}

/** 이슈 원본 record와 초기 처리 상태를 하나의 트랜잭션으로 저장합니다. */
export class IssueRecordRepository {
  /** 같은 클라이언트 record의 동시 요청을 멱등하게 저장합니다. */
  save(input: StoreIssueRecordInput): Promise<StoredIssueRecord> {
    return AppDataSource.transaction((manager) =>
      this.saveInTransaction(manager, input),
    );
  }

  /** 처리 가능한 record 하나를 잠그고 EVALUATING 상태로 전환합니다. */
  claimNext(now = new Date()): Promise<ClaimedIssueRecord | null> {
    return AppDataSource.transaction(async (manager) => {
      const staleAt = new Date(now.getTime() - 5 * 60_000);
      const processing = await manager
        .getRepository(IssueRecordProcessingEntity)
        .createQueryBuilder("processing")
        .innerJoinAndSelect("processing.record", "record")
        .where(
          `(
            processing.status = :received
            AND (
              processing."nextEvaluationAt" IS NULL
              OR processing."nextEvaluationAt" <= :now
            )
          ) OR (
            processing.status = :failed
            AND processing."nextEvaluationAt" <= :now
          ) OR (
            processing.status = :evaluating
            AND processing."updatedAt" <= :staleAt
          )`,
          {
            received: ISSUE_RECORD_STATUS.RECEIVED,
            failed: ISSUE_RECORD_STATUS.FAILED,
            evaluating: ISSUE_RECORD_STATUS.EVALUATING,
            now,
            staleAt,
          },
        )
        .orderBy("processing.updatedAt", "ASC")
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getOne();
      if (!processing) return null;

      processing.status = ISSUE_RECORD_STATUS.EVALUATING;
      processing.attemptCount += 1;
      processing.evaluationStartedAt = now;
      processing.lastErrorCode = null;
      processing.nextEvaluationAt = null;
      await manager.getRepository(IssueRecordProcessingEntity).save(processing);
      return { processing, record: processing.record };
    });
  }

  /** record가 참조하는 Session, Agent, Event를 워크스페이스 안에서 찾습니다. */
  async resolveContext(record: IssueRecordEntity): Promise<IssueRecordContext> {
    const session = record.clientSessionId
      ? await AppDataSource.getRepository(SessionEntity).findOne({
          where: {
            name: record.clientSessionId,
            workspace: { id: record.workspaceId },
          },
          relations: { agent: true },
        })
      : null;
    const agent =
      session?.agent ??
      (await AppDataSource.getRepository(AgentEntity).findOne({
        where: UUID_PATTERN.test(record.clientAgentId)
          ? [
              {
                id: record.clientAgentId,
                workspace: { id: record.workspaceId },
              },
              {
                name: record.clientAgentId,
                workspace: { id: record.workspaceId },
              },
            ]
          : {
              name: record.clientAgentId,
              workspace: { id: record.workspaceId },
            },
      }));
    const event =
      session && record.clientEventId
        ? await AppDataSource.getRepository(EventEntity).findOne({
            where: {
              session: { id: session.id },
              clientEventId: record.clientEventId,
            },
          })
        : null;
    return { session, agent, event };
  }

  /** 결정 적용 전에 평가 근거를 immutable row로 보존합니다. */
  createEvaluation(
    record: IssueRecordEntity,
    decision: IssueRecordDetectionDecision,
  ): Promise<IssueEvaluationEntity> {
    return AppDataSource.transaction(async (manager) => {
      const evaluationRepository = manager.getRepository(IssueEvaluationEntity);
      const evaluation = await evaluationRepository.save(
        evaluationRepository.create({
          workspaceId: record.workspaceId,
          recordId: record.id,
          evaluationNumber:
            (await evaluationRepository.countBy({
              recordId: record.id,
            })) + 1,
          pipeline: "DETECTION",
          action: decision.action,
          reasonCode: decision.reasonCode,
          summary: decision.summary,
          confidence: decision.confidence ?? null,
          stableFingerprint: decision.stableFingerprint ?? null,
          stableFingerprintVersion: decision.stableFingerprint ? "v1" : null,
          exactFingerprint: decision.exactFingerprint ?? null,
          exactFingerprintVersion: decision.exactFingerprint ? "v1" : null,
          matchedIssueId: decision.matchedIssueId ?? null,
          verifiedPromptVersionId: record.reportedPromptVersionId,
          evidence: decision.evidence,
          reevaluateWhen: decision.reevaluateWhen ?? null,
          evaluatorName: decision.evaluatorName,
          evaluatorVersion: decision.evaluatorVersion,
          ruleSetVersion: decision.ruleSetVersion,
        }),
      );
      return evaluation;
    });
  }

  /** Issue 반영이 끝난 평가와 record를 최종 결정 상태로 전환합니다. */
  async completeDecision(
    recordId: string,
    evaluationId: string,
    matchedIssueId: string | null,
    fingerprints?: { stable: string; exact: string },
  ): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(IssueEvaluationEntity).update(
        { id: evaluationId },
        {
          matchedIssueId,
          stableFingerprint: fingerprints?.stable ?? null,
          stableFingerprintVersion: fingerprints ? "v1" : null,
          exactFingerprint: fingerprints?.exact ?? null,
          exactFingerprintVersion: fingerprints ? "v1" : null,
        },
      );
      const processing = await manager
        .getRepository(IssueRecordProcessingEntity)
        .findOneByOrFail({ recordId });
      processing.status = ISSUE_RECORD_STATUS.DECIDED;
      processing.decidedAt = new Date();
      processing.nextEvaluationAt = null;
      await manager.getRepository(IssueRecordProcessingEntity).save(processing);
    });
  }

  /** context가 아직 준비되지 않은 record를 재평가 대상으로 되돌립니다. */
  async defer(recordId: string, nextEvaluationAt: Date): Promise<void> {
    await AppDataSource.getRepository(IssueRecordProcessingEntity).update(
      { recordId },
      {
        status: ISSUE_RECORD_STATUS.RECEIVED,
        nextEvaluationAt,
        lastErrorCode: null,
      },
    );
  }

  /** 평가 실패를 기록하고 지수형 재시도를 위한 다음 시각을 지정합니다. */
  async fail(
    recordId: string,
    errorCode: string,
    retryAt: Date | null,
  ): Promise<void> {
    await AppDataSource.getRepository(IssueRecordProcessingEntity).update(
      { recordId },
      {
        status: ISSUE_RECORD_STATUS.FAILED,
        lastErrorCode: errorCode.slice(0, 80),
        nextEvaluationAt: retryAt,
      },
    );
  }

  /** 트랜잭션 잠금 안에서 기존 record를 찾거나 새 record를 생성합니다. */
  private async saveInTransaction(
    manager: EntityManager,
    input: StoreIssueRecordInput,
  ): Promise<StoredIssueRecord> {
    // 동일 멱등성 키의 동시 요청을 직렬화해 중복 record 생성을 막습니다.
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`${input.workspaceId}:${input.sdkInstanceId}:${input.clientRecordId}`],
    );

    const recordRepository = manager.getRepository(IssueRecordEntity);
    const processingRepository = manager.getRepository(
      IssueRecordProcessingEntity,
    );
    const existingRecord = await recordRepository.findOneBy({
      workspaceId: input.workspaceId,
      sdkInstanceId: input.sdkInstanceId,
      clientRecordId: input.clientRecordId,
    });
    if (existingRecord) {
      const processing = await processingRepository.findOneByOrFail({
        recordId: existingRecord.id,
      });
      return { record: existingRecord, processing, isNew: false };
    }

    const record = await recordRepository.save(
      recordRepository.create({
        workspaceId: input.workspaceId,
        sdkInstanceId: input.sdkInstanceId,
        clientRecordId: input.clientRecordId,
        recordKind: input.recordKind,
        detectionType: input.detectionType,
        clientRunId: input.clientRunId ?? null,
        clientSessionId: input.clientSessionId ?? null,
        clientEventId: input.clientEventId ?? null,
        clientAgentId: input.clientAgentId,
        reportedPolicyId: input.reportedPolicyId ?? null,
        reportedPromptVersionId: input.reportedPromptVersionId ?? null,
        environment: input.environment,
        detectedAt: input.detectedAt,
        payload: input.payload,
        evidence: input.evidence ?? null,
      }),
    );
    const processing = await processingRepository.save(
      processingRepository.create({
        recordId: record.id,
        status: "RECEIVED",
        attemptCount: 0,
        lastErrorCode: null,
        evaluationStartedAt: null,
        decidedAt: null,
        nextEvaluationAt: null,
      }),
    );

    return { record, processing, isNew: true };
  }
}

/** 이슈 record 저장에 사용하는 기본 저장소 인스턴스입니다. */
export const issueRecordRepository = new IssueRecordRepository();
