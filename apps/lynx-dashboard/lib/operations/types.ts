export type IssueSeverity = "critical" | "warning" | "info";
export type IssueStatus = "open" | "investigating" | "resolved" | "ignored";
export type FirewallAction = "block" | "warn" | "issue_only";
export type Environment = "production" | "staging" | "development";
export type PolicyConditionType =
  | "tool_name"
  | "payload_pattern"
  | "cost_threshold"
  | "loop_detection";
export type PromptDeploymentStatus = "production" | "staged" | "rolled_back";

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface IssueEvent {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  type: "LLM_CALL" | "TOOL_CALL" | "POLICY_CHECK" | "FIREWALL_ACTIVATED";
  input?: string;
  output?: string;
  payload?: string;
  policyResult?: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Issue {
  id: string;
  title: string;
  summary: string;
  severity: IssueSeverity;
  status: IssueStatus;
  reporter: string;
  assignees: string[];
  labels: IssueLabel[];
  tags: string[];
  agentName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  fingerprint: string;
  relatedSessions: number;
  isBlocked: boolean;
  promptVersion: string;
  policyName: string;
  representativeSessionId: string;
  riskSignals: string[];
  reproduction: string[];
  events: IssueEvent[];
  collaborationTimeline: IssueCollaborationEvent[];
}

export interface IssueLabel {
  name: string;
  color: "rose" | "amber" | "blue" | "emerald" | "slate";
}

export interface IssueCollaborationEvent {
  id: string;
  type: "created" | "status_changed" | "label_added" | "tag_added" | "assigned" | "comment";
  actor: string;
  timestamp: string;
  title: string;
  body?: string;
}

export interface IssueFingerprintGroup {
  fingerprint: string;
  title: string;
  severity: IssueSeverity;
  occurrences: number;
  issueCount: number;
  agents: string[];
  lastSeenAt: string;
}

export interface IssueTrendBucket {
  label: string;
  critical: number;
  warning: number;
  info: number;
  blocked: number;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  severity: IssueSeverity;
  action: FirewallAction;
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt: string;
  connectedAgents: string[];
  conditionType: PolicyConditionType;
  conditionValue: string;
}

export interface BlockedEvent {
  id: string;
  policyId: string;
  policyName: string;
  agentName: string;
  sessionId: string;
  toolName: string;
  reason: string;
  occurredAt: string;
  severity: IssueSeverity;
  payload: string;
}

export interface PolicyCoverage {
  agentName: string;
  environment: Environment;
  enabledPolicies: number;
  disabledPolicies: number;
  missingRecommendedPolicies: string[];
  lastCheckedAt: string;
}

export interface RiskTool {
  name: string;
  category: string;
  riskLevel: IssueSeverity;
  connectedPolicies: string[];
  blockedCount: number;
  lastBlockedAt: string;
}

export interface PolicySimulationResult {
  matchedPolicies: string[];
  action: FirewallAction;
  severity: IssueSeverity;
  reason: string;
}

export interface Prompt {
  id: string;
  name: string;
  currentVersion: string;
  environment: Environment;
  linkedAgents: string[];
  lastUpdatedAt: string;
  successRateAfterLatest: number;
  openIssues: number;
  versions: PromptVersion[];
}

export interface PromptVersion {
  version: string;
  changedAt: string;
  reason: string;
  deploymentStatus: PromptDeploymentStatus;
  author: string;
  before: string;
  after: string;
  linkedIssueIds: string[];
  linkedSessionIds: string[];
}

export interface PromptChange {
  id: string;
  promptId: string;
  promptName: string;
  fromVersion: string;
  toVersion: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  successRateDelta: number;
  issueDelta: number;
}

export interface PromptRegression {
  id: string;
  promptName: string;
  version: string;
  suspectedCause: string;
  failureRateDelta: number;
  blockedDelta: number;
  linkedIssueIds: string[];
  confidence: number;
}

export interface PromptDeployment {
  promptName: string;
  environment: Environment;
  version: string;
  status: PromptDeploymentStatus;
  deployedAt: string;
  rollbackTarget?: string;
}
