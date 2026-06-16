export const GUARDRAIL_SERVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

export type GuardrailServerity =
  (typeof GUARDRAIL_SERVERITY)[keyof typeof GUARDRAIL_SERVERITY];

export const GUARDRAIL_ACTIONS = {
  WARN: "WARN",
  BLOCK: "BLOCK",
} as const;

export type GuardrailActions =
  (typeof GUARDRAIL_ACTIONS)[keyof typeof GUARDRAIL_ACTIONS];
