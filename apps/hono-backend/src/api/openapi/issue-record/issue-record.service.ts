import type { CreateIssueRecordDto } from "@repo/dto";
import {
  ISSUE_ACTOR_TYPE,
  ISSUE_CATEGORY,
  ISSUE_SEVERITY,
  ISSUE_SOURCE,
} from "@repo/constants";
import type { IssueRecordEntity } from "@repo/database";
import type { IssueRecordDetectionDecision } from "../../../common/types/issue.js";
import { renderIssueMessage } from "../../../common/services/issue-message.service.js";
import { IssueService, issueService } from "./issue.service.js";
import {
  IssueRecordRepository,
  issueRecordRepository,
} from "./issue-record.repository.js";

/** API 키에서 확인한 서버 측 테넌트 정보를 포함한 이슈 record 입력입니다. */
export interface ReceiveIssueRecordInput extends CreateIssueRecordDto {
  /** API 키로 검증된 워크스페이스 식별자입니다. */
  workspaceId: string;
  /** API 키에 연결된 실행 환경입니다. */
  environment: string;
}

/** SDK 탐지 결과를 변경하지 않고 평가 대기 record로 접수합니다. */
export class IssueRecordService {
  /** 테스트에서 저장소를 교체할 수 있도록 의존성을 주입받습니다. */
  constructor(
    private readonly repository: IssueRecordRepository = issueRecordRepository,
    private readonly issues: IssueService = issueService,
  ) {}

  /**
   * 클라이언트 record를 서버 테넌트 정보와 결합해 저장합니다.
   *
   * @param input 검증된 SDK record와 API 키에서 확인한 테넌트 정보
   * @returns record 식별자와 현재 처리 상태 및 신규 생성 여부
   */
  async receive(input: ReceiveIssueRecordInput) {
    const stored = await this.repository.save({
      workspaceId: input.workspaceId,
      environment: input.environment,
      sdkInstanceId: input.sdkInstanceId,
      clientRecordId: input.clientRecordId,
      recordKind: input.recordKind,
      detectionType: input.detectionType,
      clientRunId: input.runId,
      clientSessionId: input.sessionId,
      clientEventId: input.eventId,
      clientAgentId: input.agentId,
      reportedPolicyId: input.policyId,
      reportedPromptVersionId: input.promptVersionId,
      detectedAt: new Date(input.detectedAt),
      payload: input.payload,
      evidence: input.evidence,
    });

    return {
      recordId: stored.record.id,
      status: stored.processing.status,
      isNew: stored.isNew,
    };
  }

  /** 대기 중인 record 하나를 claim하고 평가·Issue 반영까지 수행합니다. */
  async processNext(): Promise<boolean> {
    const claimed = await this.repository.claimNext();
    if (!claimed) return false;

    try {
      if (claimed.record.recordKind === "RECOVERY") {
        const context = await this.repository.resolveContext(claimed.record);
        if (!context.agent) {
          await this.repository.defer(
            claimed.record.id,
            new Date(Date.now() + 30_000),
          );
          return true;
        }
        await this.issues.recover({
          workspaceId: claimed.record.workspaceId,
          environment: claimed.record.environment,
          agentId: context.agent.id,
          policyId: this.readString(claimed.record.reportedPolicyId),
          promptVersionId: claimed.record.reportedPromptVersionId ?? undefined,
          detectionType: claimed.record.detectionType,
          toolName: this.readString(claimed.record.payload.toolName),
          detectedAt: claimed.record.detectedAt,
          recordId: claimed.record.id,
          reporterName: claimed.record.sdkInstanceId,
          healthyObservationCount: this.readRecoveryNumber(
            claimed.record.payload.healthyObservationCount,
          ),
        });
        await this.repository.completeRecovery(claimed.record.id);
        return true;
      }

      const context = await this.repository.resolveContext(claimed.record);
      if (!context.session || !context.agent) {
        await this.repository.defer(
          claimed.record.id,
          new Date(Date.now() + 30_000),
        );
        return true;
      }

      const decision = this.evaluateDetection(claimed.record);
      const evaluation = await this.repository.createEvaluation(
        claimed.record,
        decision,
      );
      if (decision.action === "IGNORE") {
        await this.repository.completeDecision(
          claimed.record.id,
          evaluation.id,
          null,
        );
        return true;
      }

      const renderedMessage = renderIssueMessage(decision.message, "en", {
        title: decision.title ?? claimed.record.detectionType,
        summary: decision.summary,
      });
      const result = await this.issues.record({
        workspaceId: claimed.record.workspaceId,
        title: renderedMessage.title,
        summary: renderedMessage.summary,
        message: decision.message,
        category: decision.category ?? ISSUE_CATEGORY.MODEL_ERROR,
        severity: decision.severity ?? ISSUE_SEVERITY.WARNING,
        source:
          claimed.record.detectionType === "PROMPT_REGRESSION"
            ? ISSUE_SOURCE.DETECTOR
            : ISSUE_SOURCE.SDK,
        environment: claimed.record.environment,
        agentId: context.agent.id,
        policyId: this.readPolicyId(claimed.record.reportedPolicyId),
        promptVersionId: claimed.record.reportedPromptVersionId ?? undefined,
        sessionId: context.session.id,
        eventId: context.event?.id,
        isBlocked: decision.isBlocked ?? false,
        detectedAt: claimed.record.detectedAt,
        evidence: {
          ...claimed.record.evidence,
          ...decision.evidence,
          recordPayload: claimed.record.payload,
        },
        detectorVersion: decision.evaluatorVersion,
        clientOccurrenceId: claimed.record.id,
        reporter: {
          type:
            claimed.record.detectionType === "PROMPT_REGRESSION"
              ? ISSUE_ACTOR_TYPE.SYSTEM
              : ISSUE_ACTOR_TYPE.SDK,
          name:
            claimed.record.detectionType === "PROMPT_REGRESSION"
              ? "prompt-regression-detector"
              : claimed.record.sdkInstanceId,
        },
        riskSignals: this.readStringArray(claimed.record.payload.riskSignals),
        tags: [claimed.record.detectionType],
        recordId: claimed.record.id,
        evaluationId: evaluation.id,
        fingerprint: {
          detectorType: claimed.record.detectionType,
          policyId: claimed.record.reportedPolicyId ?? undefined,
          failedTool: this.readString(claimed.record.payload.toolName),
          reasonCode: decision.reasonCode,
          tools: this.readStringArray(claimed.record.payload.tools),
          context: {
            model: this.readString(claimed.record.payload.model) ?? "",
          },
        },
      });
      await this.repository.completeDecision(
        claimed.record.id,
        evaluation.id,
        result.issue.id,
        {
          stable: result.issue.stableFingerprint,
          exact: result.issue.exactFingerprint,
        },
      );
      return true;
    } catch (error) {
      const attempt = claimed.processing.attemptCount;
      const delay = Math.min(60_000, 1_000 * 2 ** Math.min(attempt, 6));
      await this.repository.fail(
        claimed.record.id,
        this.readErrorCode(error),
        attempt >= 8 ? null : new Date(Date.now() + delay),
      );
      return true;
    }
  }

  /** 확실한 SDK 탐지 유형을 구조화된 MVP 결정으로 변환합니다. */
  private evaluateDetection(
    record: IssueRecordEntity,
  ): IssueRecordDetectionDecision {
    const common = {
      confidence: 1,
      evidence: {
        detectionType: record.detectionType,
        clientEventId: record.clientEventId,
        clientSessionId: record.clientSessionId,
      },
      evaluatorName: "deterministic-record-evaluator",
      evaluatorVersion: "1.0.0",
      ruleSetVersion: "2026-07-24",
    };
    if (record.detectionType === "FIREWALL_BLOCK") {
      return {
        ...common,
        action: "CREATE",
        reasonCode: "FIREWALL_BLOCKED",
        title: "Firewall blocked an agent action",
        summary: "The SDK firewall blocked a policy-violating agent action.",
        message: {
          titleKey: "issue.firewall.block.title",
          summaryKey: "issue.firewall.block.summary",
          params: this.createMessageParams(record),
        },
        category: ISSUE_CATEGORY.FIREWALL,
        severity: ISSUE_SEVERITY.CRITICAL,
        isBlocked: true,
      };
    }
    if (record.detectionType === "FIREWALL_WARN") {
      return {
        ...common,
        action: "CREATE",
        reasonCode: "FIREWALL_WARNING",
        title: "Firewall detected a risky agent action",
        summary: "The SDK firewall reported a risky agent action.",
        message: {
          titleKey: "issue.firewall.warn.title",
          summaryKey: "issue.firewall.warn.summary",
          params: this.createMessageParams(record),
        },
        category: ISSUE_CATEGORY.FIREWALL,
        severity: ISSUE_SEVERITY.WARNING,
        isBlocked: false,
      };
    }
    if (record.detectionType === "LOOP_DETECTED") {
      return {
        ...common,
        action: "CREATE",
        reasonCode: "AGENT_LOOP_DETECTED",
        title: "Repeated agent loop detected",
        summary: "The SDK detected repeated agent behavior in one execution.",
        message: {
          titleKey: "issue.loop.detected.title",
          summaryKey: "issue.loop.detected.summary",
          params: this.createMessageParams(record),
        },
        category: ISSUE_CATEGORY.LOOP,
        severity: ISSUE_SEVERITY.WARNING,
        isBlocked: false,
      };
    }
    if (record.detectionType === "PROMPT_REGRESSION") {
      return {
        ...common,
        action: "CREATE",
        reasonCode: "PROMPT_VERSION_REGRESSION",
        title: "Prompt version performance regressed",
        summary:
          "The deployed prompt version crossed a configured success, error, or cost regression threshold.",
        message: {
          titleKey: "issue.prompt.regression.title",
          summaryKey: "issue.prompt.regression.summary",
          params: this.createMessageParams(record),
        },
        category: ISSUE_CATEGORY.PROMPT_REGRESSION,
        severity: ISSUE_SEVERITY.WARNING,
        isBlocked: false,
        evidence: {
          ...common.evidence,
          current: record.payload.current,
          baseline: record.payload.baseline,
          baseVersionId: record.payload.baseVersionId,
        },
      };
    }
    return {
      ...common,
      action: "IGNORE",
      reasonCode: "UNSUPPORTED_DETECTION_TYPE",
      summary: `No evaluator supports detection type "${record.detectionType}".`,
    };
  }

  /** bigint 정책 ID로 안전하게 전달할 수 있는 값만 반환합니다. */
  private readPolicyId(value: string | null): string | undefined {
    return value && /^\d+$/.test(value) ? value : undefined;
  }

  /** 외부 payload의 문자열 필드를 안전하게 읽습니다. */
  private readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  /** 숫자 payload 값을 안전하게 좁혀 Recovery 근거에 사용합니다. */
  private readRecoveryNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  }

  /** 외부 payload에서 문자열 배열만 남깁니다. */
  private readStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  /** 제목과 요약 렌더링에 필요한 안전한 구조화 값만 record에서 선택합니다. */
  private createMessageParams(
    record: IssueRecordEntity,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries({
        toolName: this.readString(record.payload.toolName),
        policyName: this.readString(record.payload.policyName),
        condition: this.readString(record.payload.condition),
        reason: this.readString(record.payload.reason),
        label: this.readString(record.payload.label),
        eventType: this.readString(record.payload.eventType),
        loopCount: this.readNumber(record.payload.loopCount),
      }).filter((entry) => entry[1] !== undefined),
    );
  }

  /** 유한한 숫자 payload만 메시지 파라미터로 사용합니다. */
  private readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  }

  /** 재시도 진단에 저장할 안정적인 오류 코드를 만듭니다. */
  private readErrorCode(error: unknown): string {
    return error instanceof Error && error.message
      ? error.message
      : "ISSUE_RECORD_EVALUATION_FAILED";
  }
}

/** 이슈 record 접수 요청을 처리하는 기본 서비스 인스턴스입니다. */
export const issueRecordService = new IssueRecordService();
