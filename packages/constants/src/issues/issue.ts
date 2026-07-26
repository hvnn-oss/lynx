export const ISSUE_FINGERPRINT_VERSION = {
  V1: "v1",
} as const;

export type IssueFingerprintVersion =
  (typeof ISSUE_FINGERPRINT_VERSION)[keyof typeof ISSUE_FINGERPRINT_VERSION];

export const ISSUE_SEVERITY = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFO: "INFO",
} as const;

export type IssueSeverity =
  (typeof ISSUE_SEVERITY)[keyof typeof ISSUE_SEVERITY];

export const ISSUE_STATUS = {
  OPEN: "OPEN",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
} as const;

export type IssueStatus = (typeof ISSUE_STATUS)[keyof typeof ISSUE_STATUS];

export const ISSUE_SOURCE = {
  SDK: "SDK",
  POLICY: "POLICY",
  DETECTOR: "DETECTOR",
  USER: "USER",
} as const;

export type IssueSource = (typeof ISSUE_SOURCE)[keyof typeof ISSUE_SOURCE];

export const ISSUE_CATEGORY = {
  TOOL_RISK: "TOOL_RISK",
  FIREWALL: "FIREWALL",
  LOOP: "LOOP",
  MODEL_ERROR: "MODEL_ERROR",
  PROMPT_REGRESSION: "PROMPT_REGRESSION",
  LATENCY: "LATENCY",
  COST: "COST",
  DATA_EXPOSURE: "DATA_EXPOSURE",
} as const;

export type IssueCategory =
  (typeof ISSUE_CATEGORY)[keyof typeof ISSUE_CATEGORY];

export const ISSUE_ACTIVITY_TYPE = {
  CREATED: "CREATED",
  REOPENED: "REOPENED",
  STATUS_CHANGED: "STATUS_CHANGED",
  SEVERITY_CHANGED: "SEVERITY_CHANGED",
  ASSIGNED: "ASSIGNED",
  UNASSIGNED: "UNASSIGNED",
  LABEL_ADDED: "LABEL_ADDED",
  LABEL_REMOVED: "LABEL_REMOVED",
  TAG_ADDED: "TAG_ADDED",
  COMMENTED: "COMMENTED",
} as const;

export type IssueActivityType =
  (typeof ISSUE_ACTIVITY_TYPE)[keyof typeof ISSUE_ACTIVITY_TYPE];

export const ISSUE_ACTOR_TYPE = {
  USER: "USER",
  SDK: "SDK",
  SYSTEM: "SYSTEM",
} as const;

export type IssueActorType =
  (typeof ISSUE_ACTOR_TYPE)[keyof typeof ISSUE_ACTOR_TYPE];

export const ISSUE_RECORD_KIND = {
  DETECTION: "DETECTION",
  RECOVERY: "RECOVERY",
} as const;

export type IssueRecordKind =
  (typeof ISSUE_RECORD_KIND)[keyof typeof ISSUE_RECORD_KIND];

export const ISSUE_RECORD_STATUS = {
  RECEIVED: "RECEIVED",
  EVALUATING: "EVALUATING",
  DECIDED: "DECIDED",
  FAILED: "FAILED",
} as const;

export type IssueRecordStatus =
  (typeof ISSUE_RECORD_STATUS)[keyof typeof ISSUE_RECORD_STATUS];

export const ISSUE_EVALUATION_PIPELINE = {
  DETECTION: "DETECTION",
  RESOLUTION: "RESOLUTION",
} as const;

export type IssueEvaluationPipeline =
  (typeof ISSUE_EVALUATION_PIPELINE)[keyof typeof ISSUE_EVALUATION_PIPELINE];

export const ISSUE_DETECTION_DECISION = {
  CREATE: "CREATE",
  ATTACH: "ATTACH",
  REOPEN: "REOPEN",
  IGNORE: "IGNORE",
  DEFER: "DEFER",
} as const;

export type IssueDetectionDecision =
  (typeof ISSUE_DETECTION_DECISION)[keyof typeof ISSUE_DETECTION_DECISION];

export const ISSUE_RESOLUTION_DECISION = {
  MARK_RESOLUTION_CANDIDATE: "MARK_RESOLUTION_CANDIDATE",
  KEEP_OPEN: "KEEP_OPEN",
  REJECT_RECOVERY: "REJECT_RECOVERY",
} as const;

export type IssueResolutionDecision =
  (typeof ISSUE_RESOLUTION_DECISION)[keyof typeof ISSUE_RESOLUTION_DECISION];
