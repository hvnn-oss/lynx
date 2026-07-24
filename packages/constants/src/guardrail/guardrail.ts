export const GUARDRAIL_SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

export type GuardrailSeverity =
  (typeof GUARDRAIL_SEVERITY)[keyof typeof GUARDRAIL_SEVERITY];

export const GUARDRAIL_ACTIONS = {
  WARN: "WARN",
  BLOCK: "BLOCK",
} as const;

export type GuardrailActions =
  (typeof GUARDRAIL_ACTIONS)[keyof typeof GUARDRAIL_ACTIONS];

export const RISK_LEVEL = {
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];
