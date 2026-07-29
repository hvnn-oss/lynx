import type {
  IssueActorType,
  IssueCategory,
  IssueRecordKind,
  IssueSeverity,
  IssueSource,
} from "@repo/constants";

/** 안정적인 직렬화와 해싱을 지원하는 fingerprint 입력 값입니다. */
export type FingerprintValue =
  | string
  | number
  | boolean
  | null
  | FingerprintValue[]
  | { [key: string]: FingerprintValue };

/** 반복 이슈를 같은 그룹으로 묶기 위한 정규화 입력입니다. */
export interface IssueFingerprintInput {
  category: IssueCategory;
  environment: string;
  agentId: string;
  agentVersion?: string;
  detectorType: string;
  tools?: string[];
  failedTool?: string;
  reasonCode?: string;
  policyId?: string;
  policyVersion?: string;
  promptVersionId?: string;
  context?: Record<string, FingerprintValue>;
}

/** 검토가 끝난 발생 건을 Issue에 반영할 때 사용하는 입력입니다. */
export interface RecordIssueInput {
  workspaceId: string;
  title: string;
  summary: string;
  message?: {
    titleKey: string;
    summaryKey: string;
    params: Record<string, unknown>;
  };
  category: IssueCategory;
  severity: IssueSeverity;
  source: IssueSource;
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
    type: IssueActorType;
    userId?: string;
    name: string;
  };
  riskSignals?: string[];
  reproductionSteps?: string[];
  tags?: string[];
  fingerprint: Omit<
    IssueFingerprintInput,
    "category" | "environment" | "agentId" | "promptVersionId"
  >;
}

/** IssueRecord 평가기가 반환하는 구조화된 탐지 결정입니다. */
export interface IssueRecordDetectionDecision {
  action: "CREATE" | "ATTACH" | "REOPEN" | "IGNORE" | "DEFER";
  reasonCode: string;
  summary: string;
  confidence?: number;
  matchedIssueId?: string;
  category?: IssueCategory;
  severity?: IssueSeverity;
  title?: string;
  message?: {
    titleKey: string;
    summaryKey: string;
    params: Record<string, unknown>;
  };
  isBlocked?: boolean;
  stableFingerprint?: string;
  exactFingerprint?: string;
  evidence: Record<string, unknown>;
  reevaluateWhen?: Record<string, unknown>;
  evaluatorName: string;
  evaluatorVersion: string;
  ruleSetVersion: string;
}

/** SDK에서 받은 원본 record를 변경 없이 저장하기 위한 입력입니다. */
export interface StoreIssueRecordInput {
  workspaceId: string;
  environment: string;
  sdkInstanceId: string;
  clientRecordId: string;
  recordKind: IssueRecordKind;
  detectionType: string;
  clientRunId?: string;
  clientSessionId?: string;
  clientEventId?: string;
  clientAgentId: string;
  reportedPolicyId?: string;
  reportedPromptVersionId?: string;
  detectedAt: Date;
  payload: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}
