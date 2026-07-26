import type { IngestEventDto } from "@repo/dto";
import {
  IssueRecordService,
  issueRecordService,
} from "../openapi/issue-record/issue-record.service.js";
import { PromptRepository, promptRepository } from "./prompt.repository.js";

const MINIMUM_RUN_COUNT = 20;
const SUCCESS_RATE_DROP_THRESHOLD = 0.1;
const ERROR_RATE_INCREASE_THRESHOLD = 0.1;
const COST_INCREASE_RATIO_THRESHOLD = 0.3;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DetectPromptRegressionInput {
  workspaceId: string;
  environment: string;
  event: IngestEventDto;
  resolvedAgentId: string;
}

interface PromptMetricSnapshot {
  runCount: number;
  successRate: number;
  errorRate: number;
  averageCost: number;
}

/** 프롬프트 버전 지표를 기준 버전과 비교하고 이슈 평가 record를 생성합니다. */
export class PromptRegressionService {
  constructor(
    private readonly prompts: PromptRepository = promptRepository,
    private readonly issueRecords: IssueRecordService = issueRecordService,
  ) {}

  /**
   * Session 종료 이벤트가 참조한 프롬프트 버전의 회귀 여부를 검사합니다.
   *
   * @param input 서버가 검증한 워크스페이스와 저장 완료된 이벤트 문맥
   */
  async detect(input: DetectPromptRegressionInput): Promise<void> {
    if (input.event.eventType !== "SESSION_OUTCOME") return;
    const versionIds = this.readVersionIds(
      input.event.payload.promptVersionIds,
    );
    for (const versionId of versionIds) {
      await this.detectVersion(input, versionId);
    }
  }

  /** 하나의 버전을 기준 버전과 비교해 임계값을 넘으면 record를 접수합니다. */
  private async detectVersion(
    input: DetectPromptRegressionInput,
    versionId: string,
  ): Promise<void> {
    const version = await this.prompts.findVersionById(
      input.workspaceId,
      versionId,
    );
    if (!version?.baseVersionId) return;

    const [currentRaw, baselineRaw] = await Promise.all([
      this.prompts.getVersionMetrics(input.workspaceId, version.id),
      this.prompts.getVersionMetrics(input.workspaceId, version.baseVersionId),
    ]);
    const current = this.toSnapshot(currentRaw);
    const baseline = this.toSnapshot(baselineRaw);
    if (
      current.runCount < MINIMUM_RUN_COUNT ||
      baseline.runCount < MINIMUM_RUN_COUNT
    ) {
      return;
    }

    const successRateDrop = baseline.successRate - current.successRate;
    const errorRateIncrease = current.errorRate - baseline.errorRate;
    const costIncreaseRatio =
      baseline.averageCost > 0
        ? (current.averageCost - baseline.averageCost) / baseline.averageCost
        : 0;
    if (
      successRateDrop < SUCCESS_RATE_DROP_THRESHOLD &&
      errorRateIncrease < ERROR_RATE_INCREASE_THRESHOLD &&
      costIncreaseRatio < COST_INCREASE_RATIO_THRESHOLD
    ) {
      return;
    }

    await this.issueRecords.receive({
      workspaceId: input.workspaceId,
      environment: input.environment,
      sdkInstanceId: input.event.clientId,
      clientRecordId: `prompt-regression:${version.id}:${input.event.runId}`,
      recordKind: "DETECTION",
      detectionType: "PROMPT_REGRESSION",
      runId: input.event.runId,
      // 수집 저장소도 sessionId가 없을 때 runId를 Session 외부 식별자로 사용합니다.
      sessionId: input.event.sessionId ?? input.event.runId,
      eventId: input.event.eventId,
      agentId: input.resolvedAgentId,
      promptVersionId: version.id,
      detectedAt: input.event.timestamp,
      payload: {
        promptId: version.promptId,
        baseVersionId: version.baseVersionId,
        current,
        baseline,
        successRateDrop,
        errorRateIncrease,
        costIncreaseRatio,
        riskSignals: ["PROMPT_REGRESSION"],
      },
      evidence: {
        minimumRunCount: MINIMUM_RUN_COUNT,
        thresholds: {
          successRateDrop: SUCCESS_RATE_DROP_THRESHOLD,
          errorRateIncrease: ERROR_RATE_INCREASE_THRESHOLD,
          costIncreaseRatio: COST_INCREASE_RATIO_THRESHOLD,
        },
      },
    });
  }

  /** SQL 집계 결과를 비교 가능한 비율과 평균값으로 정규화합니다. */
  private toSnapshot(raw: {
    runCount: string;
    successCount: string;
    errorRunCount: string;
    totalCost: string;
  }): PromptMetricSnapshot {
    const runCount = Number(raw.runCount);
    const successCount = Number(raw.successCount);
    const errorRunCount = Number(raw.errorRunCount);
    const totalCost = Number(raw.totalCost);
    return {
      runCount,
      successRate: runCount > 0 ? successCount / runCount : 0,
      errorRate: runCount > 0 ? errorRunCount / runCount : 0,
      averageCost: runCount > 0 ? totalCost / runCount : 0,
    };
  }

  /** 외부 payload에서 유효하고 중복되지 않은 UUID만 추출합니다. */
  private readVersionIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value.filter(
          (item): item is string =>
            typeof item === "string" && UUID_PATTERN.test(item),
        ),
      ),
    ];
  }
}

/** 이벤트 수집 이후 실행되는 기본 프롬프트 회귀 검사 서비스입니다. */
export const promptRegressionService = new PromptRegressionService();
