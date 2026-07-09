import {
  blockedEvents,
  fingerprintGroups,
  issues,
  issueTrendBuckets,
  policies,
  policyCoverage,
  promptChanges,
  promptDeployments,
  promptRegressions,
  prompts,
  riskTools,
  simulationResult,
} from "./mock-data";

export function listIssues() {
  return issues;
}

export function getIssue(issueId: string) {
  return issues.find((issue) => issue.id === issueId) ?? issues[0];
}

export function listReviewIssues() {
  return issues
    .filter((issue) => issue.status === "open" || issue.status === "investigating")
    .sort((a, b) => b.occurrences - a.occurrences);
}

export function listBlockedIssues() {
  return issues.filter((issue) => issue.isBlocked);
}

export function listFingerprintGroups() {
  return fingerprintGroups;
}

export function listIssueTrendBuckets() {
  return issueTrendBuckets;
}

export function listPolicies() {
  return policies;
}

export function getPolicy(policyId: string) {
  return policies.find((policy) => policy.id === policyId) ?? policies[0];
}

export function listBlockedEvents() {
  return blockedEvents;
}

export function listPolicyCoverage() {
  return policyCoverage;
}

export function listRiskTools() {
  return riskTools;
}

export function getPolicySimulationResult() {
  return simulationResult;
}

export function listPrompts() {
  return prompts;
}

export function getPrompt(promptId: string) {
  return prompts.find((prompt) => prompt.id === promptId) ?? prompts[0];
}

export function listPromptChanges() {
  return promptChanges;
}

export function listPromptRegressions() {
  return promptRegressions;
}

export function listPromptDeployments() {
  return promptDeployments;
}
